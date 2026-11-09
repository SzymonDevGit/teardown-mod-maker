"""Teardown Mod Maker: a block editor that turns blocks into a Teardown mod.

Everything runs in the browser, so this server only shows the page. build_static.py turns it into
plain files for free static hosting.
"""

import json
from pathlib import Path

from flask import Flask, abort, render_template

BASE_DIR = Path(__file__).resolve().parent
LANGUAGES = ("en", "pl")
DEFAULT_LANGUAGE = "en"
BLOCKLY_VERSION = "12.3.1"  # the copy in static/js/vendor/blockly (see its README)

# The YouTube video the tutorial popup plays: https://youtu.be/EEuTusiPb7M
# While it's empty, the popup and the Tutorial button stay hidden.
TUTORIAL_VIDEO_ID = "EEuTusiPb7M"

# Discord server for bug reports and suggestions, shown in the bottom bar.
DISCORD_URL = "https://discord.gg/bHxaXgjpfe"

# Shown in the bottom bar under "Look at my other work!".
OTHER_WORK = (
    ("szy.monster", "https://szy.monster/"),
    ("Cheltenham Data", "https://cheltenhamdata.co.uk/"),
    ("LinkedIn", "https://www.linkedin.com/in/szy05"),
)

# Who to contact about privacy and data requests, and when the privacy notice last changed.
CONTACT_EMAIL = "info@cheltenhamdata.co.uk"
PRIVACY_UPDATED = "2026-11-09"

app = Flask(__name__)


def load_translations():
    return {
        lang: json.loads((BASE_DIR / "translations" / f"{lang}.json").read_text(encoding="utf-8"))
        for lang in LANGUAGES
    }


TRANSLATIONS = load_translations()


def page_path(lang):
    """English is at /, other languages at /<lang>/."""
    return "/" if lang == DEFAULT_LANGUAGE else f"/{lang}/"


def privacy_path(lang):
    """The privacy notice: /privacy/ in English, /<lang>/privacy/ in other languages."""
    return page_path(lang) + "privacy/"


@app.get("/privacy/")
def privacy():
    return render_privacy(DEFAULT_LANGUAGE)


@app.get("/<lang>/privacy/")
def privacy_in(lang):
    if lang not in LANGUAGES or lang == DEFAULT_LANGUAGE:
        abort(404)
    return render_privacy(lang)


def render_privacy(lang):
    return render_template(
        "privacy.html",
        lang=lang,
        t=TRANSLATIONS[lang],
        editor_url=page_path(lang),
        pages={code: privacy_path(code) for code in LANGUAGES},
        updated=PRIVACY_UPDATED,
        contact_email=CONTACT_EMAIL,
    )


@app.get("/")
def editor():
    return render_editor(DEFAULT_LANGUAGE)


@app.get("/<lang>/")
def editor_in(lang):
    if lang not in LANGUAGES or lang == DEFAULT_LANGUAGE:
        abort(404)
    return render_editor(lang)


def render_editor(lang):
    return render_template(
        "index.html",
        lang=lang,
        default_language=DEFAULT_LANGUAGE,
        pages={code: page_path(code) for code in LANGUAGES},
        t=TRANSLATIONS[lang],
        privacy_url=privacy_path(lang),
        tutorial_video_id=TUTORIAL_VIDEO_ID,
        other_work=OTHER_WORK,
        discord_url=DISCORD_URL,
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000)
