"""Teardown Mod Maker: a block editor that turns blocks into a Teardown mod."""

import base64
import binascii
import io
import json
from pathlib import Path

from flask import Flask, jsonify, redirect, render_template, request, send_file, url_for

from modpack import ModError, build_mod_zip

BASE_DIR = Path(__file__).resolve().parent
LANGUAGES = ("en", "pl")
DEFAULT_LANGUAGE = "en"
BLOCKLY_VERSION = "12.3.1"

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 4 * 1024 * 1024


def load_translations():
    return {
        lang: json.loads((BASE_DIR / "translations" / f"{lang}.json").read_text(encoding="utf-8"))
        for lang in LANGUAGES
    }


TRANSLATIONS = load_translations()


def current_language():
    lang = request.cookies.get("lang", DEFAULT_LANGUAGE)
    return lang if lang in LANGUAGES else DEFAULT_LANGUAGE


@app.get("/")
def editor():
    lang = current_language()
    return render_template(
        "index.html",
        lang=lang,
        languages=LANGUAGES,
        t=TRANSLATIONS[lang],
        blockly_version=BLOCKLY_VERSION,
    )


@app.get("/lang/<lang>")
def set_language(lang):
    response = redirect(url_for("editor"))
    if lang in LANGUAGES:
        response.set_cookie("lang", lang, max_age=60 * 60 * 24 * 365, samesite="Lax")
    return response


@app.post("/api/export")
def export_mod():
    data = request.get_json(silent=True) or {}
    vox = None
    if data.get("vox"):
        try:
            vox = base64.b64decode(data["vox"], validate=True)
        except (binascii.Error, ValueError, TypeError):
            return jsonify(error="not_vox"), 400
    try:
        folder, payload = build_mod_zip(
            name=data.get("name", ""),
            author=data.get("author", ""),
            description=data.get("description", ""),
            lua=data.get("lua", ""),
            vox=vox,
            has_tool=data.get("tool", True) is not False,
        )
    except ModError as err:
        return jsonify(error=str(err)), 400
    return send_file(
        io.BytesIO(payload),
        mimetype="application/zip",
        as_attachment=True,
        download_name=f"{folder}.zip",
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000)
