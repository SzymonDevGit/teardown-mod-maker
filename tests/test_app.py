import base64
import io
import re
import struct
import zipfile
from pathlib import Path

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


def test_export_without_tool_is_gameplay_mod(client):
    response = client.post("/api/export", json={"name": "Lava", "lua": LUA, "tool": False})
    with zipfile.ZipFile(io.BytesIO(response.data)) as zf:
        assert sorted(zf.namelist()) == ["lava/info.txt", "lava/main.lua"]
        assert "tags = Gameplay\n" in zf.read("lava/info.txt").decode()


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


BLOCKS_JS = (Path(__file__).resolve().parent.parent / "static" / "js" / "blocks.js").read_text(encoding="utf-8")


def block_terms():
    body = BLOCKS_JS.split("window.BLOCK_TERMS = {", 1)[1].split("};", 1)[0]
    return dict(re.findall(r"(\w+): \"(\w+)\"", body))


def defined_blocks():
    defined = set(re.findall(r'(?:eventBlock|actionBlock|valueBlock)\("(td_\w+)"', BLOCKS_JS))
    return defined | set(re.findall(r'type: "(td_\w+)",\n', BLOCKS_JS))


def test_every_teardown_block_has_hold_t_help():
    defined = defined_blocks()
    terms = block_terms()
    assert defined, "no blocks found in blocks.js"
    assert defined - terms.keys() == set()
    for lang in ("en", "pl"):
        assert set(terms.values()) - TRANSLATIONS[lang]["terms"].keys() == set()


def test_every_block_text_and_category_is_translated():
    used = set(re.findall(r"\bB\.(\w+)", BLOCKS_JS))
    light_colours = BLOCKS_JS.split("const LIGHT_COLOURS = {", 1)[1].split("};", 1)[0]
    used |= {"colour_" + c for c in re.findall(r"(\w+): \[", light_colours)}
    categories = set(re.findall(r'category\("(\w+)"', BLOCKS_JS)) | set(re.findall(r"\bC\.(\w+)", BLOCKS_JS))
    item_ids = set(re.findall(r'toolboxitemid: "(\w+)"', BLOCKS_JS)) | set(re.findall(r'category\("(\w+)"', BLOCKS_JS))
    for lang in ("en", "pl"):
        assert used - TRANSLATIONS[lang]["blocks"].keys() == set()
        assert categories - TRANSLATIONS[lang]["categories"].keys() == set()
        assert item_ids - TRANSLATIONS[lang]["terms"].keys() == set()


def test_block_messages_have_matching_placeholders():
    # Blockly needs the same %1, %2... in every language, or the block breaks.
    for key, english in TRANSLATIONS["en"]["blocks"].items():
        polish = TRANSLATIONS["pl"]["blocks"][key]
        assert sorted(re.findall(r"%\d", english)) == sorted(re.findall(r"%\d", polish)), key


def test_every_teardown_block_is_in_the_toolbox():
    toolbox = BLOCKS_JS.split("window.TOOLBOX = {", 1)[1].split("window.BLOCK_TERMS", 1)[0]
    assert defined_blocks() - set(re.findall(r'block\("(td_\w+)"', toolbox)) == set()


def test_my_blocks_cannot_take_teardown_names():
    # Every game function the mod calls must be reserved, so a kid's block or variable can't replace it.
    reserved = BLOCKS_JS.split("const TEARDOWN_NAMES = [", 1)[1].split("];", 1)[0]
    reserved = set(re.findall(r'"(\w+)"', reserved))
    called = set(re.findall(r"\b([A-Z][A-Za-z]+)\(", BLOCKS_JS)) - {"FN", "Number", "String", "Set", "Map", "Boolean"}
    assert called - reserved == set()
    assert {"init", "tick", "update", "draw"} <= reserved


def test_default_vox_is_solid_and_held_low():
    vox = build_default_vox()
    start = vox.index(b"XYZI") + 12
    count = struct.unpack_from("<i", vox, start)[0]
    colours = {vox[start + 4 + i * 4 + 3] for i in range(count)}
    # Palette indices 1-8 are glass in Teardown, which makes the tool see-through.
    assert colours and min(colours) > 8
    # Moved down and forward like Teardown's example laser gun, so it isn't held at eye level.
    assert b"_t" in vox and b"0 9 -11" in vox
