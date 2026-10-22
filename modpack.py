"""Makes the default tool model (static/vox/tool.vox) and the things the "shoot a ..." block can shoot
(static/vox/shoot/*.vox).

The mod zip itself is built in the browser (static/js/modpack.js). Run this file after changing a model:

    python modpack.py
"""

import struct
from pathlib import Path

VOX_PATH = Path(__file__).resolve().parent / "static" / "vox" / "tool.vox"
SHOOT_DIR = VOX_PATH.parent / "shoot"


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

    colours = {VOX_DARK: (55, 55, 60), VOX_GREY: (125, 125, 130), VOX_ORANGE: (240, 120, 30)}
    return vox_bytes((size_x, size_y, size_z), voxels, colours, move="0 9 -11")


def vox_bytes(size, voxels, colours, move=None):
    """A MagicaVoxel file with one model. colours maps palette index to (r, g, b).

    move puts the model somewhere else in the file's scene, for example "0 9 -11".
    """

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
    for index, (r, g, b) in colours.items():
        palette[index - 1] = (r, g, b, 255)

    parts = [
        chunk(b"SIZE", struct.pack("<iii", *size)),
        chunk(b"XYZI", struct.pack("<i", len(voxels)) + b"".join(bytes(v) for v in voxels)),
    ]
    if move:
        parts += [
            # Scene: root transform > group > transform that moves the model > the model itself.
            transform(0, 1, -1),
            chunk(b"nGRP", struct.pack("<i", 1) + attributes() + struct.pack("<ii", 1, 2)),
            transform(2, 3, 0, [("_t", move)]),
            chunk(b"nSHP", struct.pack("<i", 3) + attributes() + struct.pack("<ii", 1, 0) + attributes()),
            chunk(b"LAYR", struct.pack("<i", 0) + attributes() + struct.pack("<i", -1)),
        ]
    parts.append(chunk(b"RGBA", b"".join(bytes(c) for c in palette)))
    return b"VOX " + struct.pack("<i", 150) + chunk(b"MAIN", b"", b"".join(parts))


# Palette rows for the things to shoot (Teardown's material for each block of 8 palette indices).
PLASTIC, WOOD, METAL, MASONRY, HEAVY_METAL = 161, 57, 121, 73, 137


def _sphere(radius):
    size = 2 * radius + 1
    return size, [(x, y, z) for x in range(size) for y in range(size) for z in range(size)
                  if (x - radius) ** 2 + (y - radius) ** 2 + (z - radius) ** 2 <= (radius + 0.3) ** 2]


def build_shoot_models():
    """The five things the "shoot a ..." block can shoot, as {name: vox bytes}. One voxel is 10 cm."""
    import math

    models = {}

    # A beach ball with four coloured stripes.
    size, points = _sphere(3)
    voxels = [(x, y, z, PLASTIC + int((math.atan2(y - 3, x - 3) + math.pi) / (math.pi / 2)) % 4) for x, y, z in points]
    models["ball"] = vox_bytes((size, size, size), voxels, {
        PLASTIC: (220, 40, 40), PLASTIC + 1: (250, 210, 40), PLASTIC + 2: (40, 110, 220), PLASTIC + 3: (245, 245, 245)})

    # A wooden crate with dark edges.
    voxels = []
    for x in range(8):
        for y in range(8):
            for z in range(8):
                edge = sum(c in (0, 7) for c in (x, y, z)) >= 2
                voxels.append((x, y, z, WOOD + 1 if edge else WOOD))
    models["crate"] = vox_bytes((8, 8, 8), voxels, {WOOD: (190, 140, 80), WOOD + 1: (110, 70, 35)})

    # A red metal barrel with dark rings.
    voxels = [(x, y, z, METAL + 1 if z in (0, 2, 6, 8) else METAL)
              for x in range(7) for y in range(7) for z in range(9) if (x - 3) ** 2 + (y - 3) ** 2 <= 10]
    models["barrel"] = vox_bytes((7, 7, 9), voxels, {METAL: (190, 35, 30), METAL + 1: (60, 60, 65)})

    # A big brick.
    voxels = [(x, y, z, MASONRY) for x in range(6) for y in range(3) for z in range(3)]
    models["brick"] = vox_bytes((6, 3, 3), voxels, {MASONRY: (165, 70, 45)})

    # A heavy wrecking ball, 1.3 m wide.
    size, points = _sphere(6)
    models["wrecking_ball"] = vox_bytes((size, size, size), [(x, y, z, HEAVY_METAL) for x, y, z in points],
                                        {HEAVY_METAL: (45, 45, 50)})
    return models



if __name__ == "__main__":
    SHOOT_DIR.mkdir(parents=True, exist_ok=True)
    VOX_PATH.write_bytes(build_default_vox())
    print(f"Wrote {VOX_PATH}")
    for name, vox in build_shoot_models().items():
        (SHOOT_DIR / f"{name}.vox").write_bytes(vox)
        print(f"Wrote {SHOOT_DIR / name}.vox")
