import base64
import io
import struct
import zipfile

import pytest

from app import TRANSLATIONS, app
from modpack import build_default_vox, slugify

LUA = 'function init()\nend\n\nfunction tick(dt)\nend\n'


@pytest.fixture
def client():
    app.config["TESTING"] = True
    return app.test_client()


def keys(tree, prefix=""):
    found = set()
    for key, value in tree.items():
        path = f"{prefix}{key}"
        found |= keys(value, path + ".") if isinstance(value, dict) else {path}
    return found


def test_polish_has_every_english_text():
    assert keys(TRANSLATIONS["pl"]) == keys(TRANSLATIONS["en"])


def test_editor_defaults_to_english(client):
    page = client.get("/").get_data(as_text=True)
    assert 'lang="en"' in page
    assert "Download mod" in page


def test_language_switch_sets_polish(client):
    response = client.get("/lang/pl")
    assert response.status_code == 302
    page = client.get("/").get_data(as_text=True)
    assert 'lang="pl"' in page
    assert "Pobierz moda" in page


def test_unknown_language_is_ignored(client):
    client.get("/lang/xx")
    assert 'lang="en"' in client.get("/").get_data(as_text=True)


def test_export_builds_mod_folder(client):
    response = client.post("/api/export", json={
        "name": "Boom Stick!", "author": "Szymon", "description": "Goes\nboom", "lua": LUA,
    })
    assert response.status_code == 200
    assert response.mimetype == "application/zip"
    with zipfile.ZipFile(io.BytesIO(response.data)) as zf:
        assert sorted(zf.namelist()) == ["boom_stick/info.txt", "boom_stick/main.lua", "boom_stick/vox/tool.vox"]
        info = zf.read("boom_stick/info.txt").decode()
        assert "name = Boom Stick!\n" in info
        assert "description = Goes boom\n" in info
        assert zf.read("boom_stick/main.lua").decode() == LUA


def test_export_uses_uploaded_vox(client):
    vox = b"VOX " + struct.pack("<i", 150) + b"custom"
    response = client.post("/api/export", json={"name": "x", "lua": LUA, "vox": base64.b64encode(vox).decode()})
    with zipfile.ZipFile(io.BytesIO(response.data)) as zf:
        assert zf.read("x/vox/tool.vox") == vox


@pytest.mark.parametrize("body, error", [
    ({"name": "x", "lua": "  "}, "empty_mod"),
    ({"name": "x", "lua": "x" * 300_000}, "too_big"),
    ({"name": "x", "lua": LUA, "vox": base64.b64encode(b"not a model").decode()}, "not_vox"),
    ({"name": "x", "lua": LUA, "vox": "%%%"}, "not_vox"),
])
def test_export_rejects_bad_input(client, body, error):
    response = client.post("/api/export", json=body)
    assert response.status_code == 400
    assert response.get_json()["error"] == error


def test_slugify_handles_polish_letters():
    assert slugify("Mój Łuk") == "moj_luk"
    assert slugify("!!!") == "my_mod"


def test_default_vox_is_valid_magicavoxel():
    vox = build_default_vox()
    assert vox[:4] == b"VOX "
    assert struct.unpack("<i", vox[4:8])[0] == 150
    assert vox[8:12] == b"MAIN"
    content_size, children_size = struct.unpack("<ii", vox[12:20])
    assert content_size == 0
    assert 20 + children_size == len(vox)
