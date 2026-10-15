"""Builds the downloadable Teardown mod: a zip with info.txt, main.lua and a tool model."""

import io
import re
import struct
import unicodedata
import zipfile

MAX_LUA_BYTES = 200_000
MAX_VOX_BYTES = 2_000_000


class ModError(ValueError):
    """Raised when the mod details sent by the editor can't be used."""


def slugify(text, fallback="my_mod"):
    """Turn 'Boom Stick!' into 'boom_stick' for folder and tool ids."""
    text = unicodedata.normalize("NFKD", text.lower().replace("ł", "l")).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "_", text).strip("_")
    return slug[:40] or fallback


def clean_line(text, limit):
    """info.txt is one 'key = value' per line, so values must stay on one line."""
    return " ".join(str(text or "").split())[:limit]


def build_info_txt(name, author, description):
    return (
        f"name = {clean_line(name, 60)}\n"
        f"author = {clean_line(author, 60)}\n"
        f"description = {clean_line(description, 300)}\n"
        "tags = Tool\n"
    )


def build_default_vox():
    """A small grey-and-orange stick in MagicaVoxel format, used when no model is uploaded."""
    size_x, size_y, size_z = 3, 12, 4
    voxels = []
    for y in range(size_y):
        for x in range(size_x):
            for z in range(1, 3):
                colour = 2 if y >= size_y - 2 else 1
                voxels.append((x, y, z, colour))
    # Handle below the back end.
    for y in range(1, 3):
        for x in range(size_x):
            voxels.append((x, y, 0, 1))

    def chunk(chunk_id, content, children=b""):
        return chunk_id + struct.pack("<ii", len(content), len(children)) + content + children

    size = chunk(b"SIZE", struct.pack("<iii", size_x, size_y, size_z))
    xyzi = chunk(b"XYZI", struct.pack("<i", len(voxels)) + b"".join(bytes(v) for v in voxels))
    palette = [(90, 90, 95, 255), (240, 120, 30, 255)] + [(0, 0, 0, 255)] * 254
    rgba = chunk(b"RGBA", b"".join(bytes(c) for c in palette))
    return b"VOX " + struct.pack("<i", 150) + chunk(b"MAIN", b"", size + xyzi + rgba)


def build_mod_zip(name, author, description, lua, vox=None):
    """Return (folder_name, zip_bytes). The zip holds one folder ready for Teardown's mods folder."""
    if not isinstance(lua, str) or not lua.strip():
        raise ModError("empty_mod")
    if len(lua.encode("utf-8")) > MAX_LUA_BYTES:
        raise ModError("too_big")
    if vox is not None:
        if len(vox) > MAX_VOX_BYTES:
            raise ModError("vox_too_big")
        if not vox.startswith(b"VOX "):
            raise ModError("not_vox")

    name = clean_line(name, 60) or "My Mod"
    folder = slugify(name)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"{folder}/info.txt", build_info_txt(name, author, description))
        zf.writestr(f"{folder}/main.lua", lua)
        zf.writestr(f"{folder}/vox/tool.vox", vox or build_default_vox())
    return folder, buffer.getvalue()
