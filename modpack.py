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


def build_info_txt(name, author, description, has_tool=True):
    # Tags sort the mod in the Steam Workshop. A mod without a tool is a gameplay mod.
    return (
        f"name = {clean_line(name, 60)}\n"
        f"author = {clean_line(author, 60)}\n"
        f"description = {clean_line(description, 300)}\n"
        f"tags = {'Tool' if has_tool else 'Gameplay'}\n"
    )


# Teardown picks a voxel's material from its palette index, in rows of 8: 1-8 are glass (see-through),
# so a model coloured with the first palette entries is almost invisible. These are solid ones.
VOX_DARK = 130  # metal
VOX_GREY = 125  # metal
VOX_ORANGE = 153  # plastic


def build_default_vox():
    """A grey stick with an orange tip, in MagicaVoxel format, used when no model is uploaded.

    It copies the size and placement of the laser gun in Teardown's own example mod (7 x 30 x 7 voxels,
    moved to 0 9 -11), so the game holds it low on the right like a normal tool. A model at the
    file's origin is held at eye level instead, with the hand in front of the face.
    MagicaVoxel's +y becomes forward in the game, so the tip is at the high y end.
    """
    size_x, size_y, size_z = 7, 30, 7
    voxels = []

    def square(y, half, colour):
        # A rounded square across the stick, centred on x = 3, z = 3.
        for x in range(3 - half, 4 + half):
            for z in range(3 - half, 4 + half):
                if half >= 2 and abs(x - 3) == half and abs(z - 3) == half:
                    continue
                voxels.append((x, y, z, colour))

    for y in range(size_y):
        if y < 10:
            square(y, 1, VOX_DARK)  # handle
        elif y < 12 or 23 <= y < 25:
            square(y, 3, VOX_DARK)  # rings
        elif y < 23:
            square(y, 2, VOX_GREY)  # body
        else:
            square(y, 2 if y < 28 else 1, VOX_ORANGE)  # tip

    def chunk(chunk_id, content, children=b""):
        return chunk_id + struct.pack("<ii", len(content), len(children)) + content + children

    def text(value):
        data = value.encode("ascii")
        return struct.pack("<i", len(data)) + data

    def attributes(pairs=()):
        return struct.pack("<i", len(pairs)) + b"".join(text(k) + text(v) for k, v in pairs)

    def transform(node, child, layer, frame=()):
        return chunk(b"nTRN", struct.pack("<i", node) + attributes() + struct.pack("<iiii", child, -1, layer, 1) + attributes(frame))

    palette = [(0, 0, 0, 255)] * 256
    # The RGBA chunk's entry i is the colour of palette index i + 1.
    palette[VOX_DARK - 1] = (55, 55, 60, 255)
    palette[VOX_GREY - 1] = (125, 125, 130, 255)
    palette[VOX_ORANGE - 1] = (240, 120, 30, 255)

    children = b"".join([
        chunk(b"SIZE", struct.pack("<iii", size_x, size_y, size_z)),
        chunk(b"XYZI", struct.pack("<i", len(voxels)) + b"".join(bytes(v) for v in voxels)),
        # Scene: root transform > group > transform that moves the model > the model itself.
        transform(0, 1, -1),
        chunk(b"nGRP", struct.pack("<i", 1) + attributes() + struct.pack("<ii", 1, 2)),
        transform(2, 3, 0, [("_t", "0 9 -11")]),
        chunk(b"nSHP", struct.pack("<i", 3) + attributes() + struct.pack("<ii", 1, 0) + attributes()),
        chunk(b"LAYR", struct.pack("<i", 0) + attributes() + struct.pack("<i", -1)),
        chunk(b"RGBA", b"".join(bytes(c) for c in palette)),
    ])
    return b"VOX " + struct.pack("<i", 150) + chunk(b"MAIN", b"", children)


def build_mod_zip(name, author, description, lua, vox=None, has_tool=True):
    """Return (folder_name, zip_bytes). The zip holds one folder ready for Teardown's mods folder.

    The tool model is only added when the mod has a tool.
    """
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
        zf.writestr(f"{folder}/info.txt", build_info_txt(name, author, description, has_tool))
        zf.writestr(f"{folder}/main.lua", lua)
        if has_tool:
            zf.writestr(f"{folder}/vox/tool.vox", vox or build_default_vox())
    return folder, buffer.getvalue()
