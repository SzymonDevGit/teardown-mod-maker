import base64
import io
import json
import re
import shutil
import struct
import subprocess
import zipfile
from pathlib import Path

import pytest

from app import TRANSLATIONS, app
from build_static import build
from modpack import SHOOT_DIR, VOX_PATH, build_default_vox, build_shoot_models

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


def test_polish_page(client):
    page = client.get("/pl/").get_data(as_text=True)
    assert 'lang="pl"' in page
    assert "Pobierz moda" in page


@pytest.mark.parametrize("path", ["/en/", "/xx/"])
def test_unknown_language_page_is_missing(client, path):
    assert client.get(path).status_code == 404


def test_static_build_has_every_language(tmp_path):
    dist = build(tmp_path / "dist")
    assert 'lang="en"' in (dist / "index.html").read_text(encoding="utf-8")
    assert 'lang="pl"' in (dist / "pl" / "index.html").read_text(encoding="utf-8")
    for name in ("js/main.js", "js/modpack.js", "vox/tool.vox"):
        assert (dist / "static" / name).is_file()


def test_tool_vox_file_matches_the_model():
    # static/vox/tool.vox is what the browser puts in the zip. Run `python modpack.py` after changing the model.
    assert VOX_PATH.read_bytes() == build_default_vox()


NODE = shutil.which("node")
MODPACK_JS = Path(__file__).resolve().parent.parent / "static" / "js" / "modpack.js"


def run_modpack_js(**options):
    """Build a zip with static/js/modpack.js in Node. Returns (zip bytes, None) or (None, error code)."""
    if not NODE:
        pytest.skip("Node.js is not installed")
    script = """
const M = require(process.argv[1]);
const o = JSON.parse(require("fs").readFileSync(0, "utf8"));
for (const k of ["vox", "defaultVox"]) if (o[k]) o[k] = Uint8Array.from(Buffer.from(o[k], "base64"));
for (const f of o.extraFiles || []) f.data = Uint8Array.from(Buffer.from(f.data, "base64"));
try {
  process.stdout.write(JSON.stringify({ zip: Buffer.from(M.buildModZip(o).bytes).toString("base64") }));
} catch (e) {
  process.stdout.write(JSON.stringify({ error: e instanceof M.ModError ? e.message : String(e) }));
}
"""
    for key in ("vox", "defaultVox"):
        if options.get(key) is not None:
            options[key] = base64.b64encode(options[key]).decode()
    for file in options.get("extraFiles", []):
        file["data"] = base64.b64encode(file["data"]).decode()
    result = subprocess.run([NODE, "-e", script, str(MODPACK_JS)], input=json.dumps(options),
                            capture_output=True, text=True, check=True)
    out = json.loads(result.stdout)
    return (base64.b64decode(out["zip"]), None) if "zip" in out else (None, out["error"])


def test_zip_has_mod_folder():
    data, _ = run_modpack_js(name="Boom Stick!", author="Szymon", description="Goes\nboom", lua=LUA,
                             defaultVox=build_default_vox())
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        assert zf.testzip() is None
        assert sorted(zf.namelist()) == ["boom_stick/info.txt", "boom_stick/main.lua", "boom_stick/vox/tool.vox"]
        info = zf.read("boom_stick/info.txt").decode()
        assert "name = Boom Stick!\n" in info
        assert "description = Goes boom\n" in info
        assert "tags = Tool\n" in info
        assert zf.read("boom_stick/main.lua").decode() == LUA
        assert zf.read("boom_stick/vox/tool.vox") == build_default_vox()


def test_zip_without_tool_is_gameplay_mod():
    data, _ = run_modpack_js(name="Lava", lua=LUA, hasTool=False)
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        assert sorted(zf.namelist()) == ["lava/info.txt", "lava/main.lua"]
        assert "tags = Gameplay\n" in zf.read("lava/info.txt").decode()


def test_zip_uses_uploaded_vox():
    vox = b"VOX " + struct.pack("<i", 150) + b"custom"
    data, _ = run_modpack_js(name="x", lua=LUA, vox=vox, defaultVox=build_default_vox())
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        assert zf.read("x/vox/tool.vox") == vox


def test_zip_keeps_polish_text():
    lua = 'DebugPrint("Zażółć gęślą jaźń")\n'
    data, _ = run_modpack_js(name="Mój Łuk", lua=lua, hasTool=False)
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        assert zf.read("moj_luk/main.lua").decode() == lua
        assert "name = Mój Łuk\n" in zf.read("moj_luk/info.txt").decode()


@pytest.mark.parametrize("options, error", [
    ({"name": "x", "lua": "  "}, "empty_mod"),
    ({"name": "x", "lua": "x" * 300_000}, "too_big"),
    ({"name": "x", "lua": LUA, "vox": b"not a model"}, "not_vox"),
    ({"name": "x", "lua": LUA, "vox": b"VOX " + b"0" * 2_000_001}, "vox_too_big"),
])
def test_zip_rejects_bad_input(options, error):
    assert run_modpack_js(**options) == (None, error)


@pytest.mark.parametrize("name, slug", [("Mój Łuk", "moj_luk"), ("!!!", "my_mod"), ("Boom Stick!", "boom_stick")])
def test_folder_name_handles_polish_letters(name, slug):
    data, _ = run_modpack_js(name=name, lua=LUA, hasTool=False)
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        assert zf.namelist()[0].split("/")[0] == slug


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


def test_other_work_links_in_both_languages(client):
    for path, heading in (("/", "Look at my other work!"), ("/pl/", "Zobacz moje inne projekty!")):
        page = client.get(path).get_data(as_text=True)
        assert heading in page
        for url in ("https://szy.monster/", "https://cheltenhamdata.co.uk/", "https://www.linkedin.com/in/szy05"):
            assert f'href="{url}"' in page


def test_tutorial_popup_needs_a_video(client, monkeypatch):
    import app as app_module

    monkeypatch.setattr(app_module, "TUTORIAL_VIDEO_ID", "")
    assert "tutorial-dialog" not in client.get("/").get_data(as_text=True)
    monkeypatch.setattr(app_module, "TUTORIAL_VIDEO_ID", "abc123XYZ_-")
    page = client.get("/").get_data(as_text=True)
    assert 'id="tutorial-dialog"' in page
    assert "youtube-nocookie.com/embed/abc123XYZ_-" in page


def test_shoot_model_files_match_the_models():
    # static/vox/shoot/*.vox are what the browser puts in the zip. Run `python modpack.py` after changing them.
    models = build_shoot_models()
    assert sorted(models) == ["ball", "barrel", "brick", "crate", "wrecking_ball"]
    for name, vox in models.items():
        assert (SHOOT_DIR / f"{name}.vox").read_bytes() == vox
        start = vox.index(b"XYZI") + 12
        count = struct.unpack_from("<i", vox, start)[0]
        # Palette indices 1-8 are glass in Teardown.
        assert count and min(vox[start + 4 + i * 4 + 3] for i in range(count)) > 8, name


def test_shoot_block_offers_every_model():
    things = re.findall(r'\[B\.thing_\w+, "(\w+)"\]', BLOCKS_JS)
    assert sorted(things) == sorted(list(build_shoot_models()) + ["my_model"])


def test_zip_adds_shoot_models():
    ball = build_shoot_models()["ball"]
    data, _ = run_modpack_js(name="Ball", lua=LUA, hasTool=False, extraFiles=[{"path": "vox/ball.vox", "data": ball}])
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        assert zf.read("ball/vox/ball.vox") == ball
    _, error = run_modpack_js(name="Ball", lua=LUA, hasTool=False, extraFiles=[{"path": "vox/x.vox", "data": b"nope"}])
    assert error == "not_vox"


EXAMPLES_JS = Path(__file__).resolve().parent.parent / "static" / "js" / "examples.js"
STANDARD_BLOCKS = {"controls_if", "controls_repeat_ext", "logic_compare", "math_number", "math_change", "text",
                   "text_join", "variables_get", "variables_set", "procedures_defnoreturn", "procedures_callnoreturn"}


@pytest.mark.parametrize("lang", ["en", "pl"])
def test_examples_use_real_blocks_and_text(lang):
    if not NODE:
        pytest.skip("Node.js is not installed")
    # Runs examples.js with the page's words, and fails on any word the translations are missing.
    script = """
global.window = { APP: { t: JSON.parse(require("fs").readFileSync(0, "utf8")) } };
require(process.argv[1]);
const check = (value, path) => {
  if (value === undefined) throw new Error("missing text at " + path);
  if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) check(v, path + "." + k);
};
const out = window.EXAMPLES.map((e) => { const p = e.project(); check(p, e.id); return { id: e.id, stars: e.stars, project: p }; });
process.stdout.write(JSON.stringify(out));
"""
    result = subprocess.run([NODE, "-e", script, str(EXAMPLES_JS)], input=json.dumps(TRANSLATIONS[lang]),
                            capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    examples = json.loads(result.stdout)
    assert [e["stars"] for e in examples] == [1, 2, 3, 4, 5]
    assert {e["id"] for e in examples} == set(TRANSLATIONS[lang]["examples"])
    types = set(re.findall(r'"type": "(\w+)"', json.dumps([e["project"] for e in examples])))
    assert types - defined_blocks() - STANDARD_BLOCKS == set()
    for e in examples:
        assert e["project"]["format"] == "teardown-mod-maker"
        assert e["project"]["info"]["name"] == TRANSLATIONS[lang]["examples"][e["id"]]["name"]
