// Builds the downloadable Teardown mod in the browser: a zip with info.txt, main.lua and a tool model.
// It runs in the page, so the editor works as a plain static website with no server.
(function (root) {
  const MAX_LUA_BYTES = 200_000;
  const MAX_VOX_BYTES = 2_000_000;
  const encoder = new TextEncoder();

  class ModError extends Error {}

  /** Turn "Boom Stick!" into "boom_stick" for the folder name. */
  function slugify(text, fallback = "my_mod") {
    const slug = String(text || "").toLowerCase().replace(/ł/g, "l").normalize("NFKD")
      .replace(/[^\x00-\x7f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return slug.slice(0, 40) || fallback;
  }

  /** info.txt is one "key = value" per line, so values must stay on one line. */
  function cleanLine(text, limit) {
    return String(text || "").split(/\s+/).filter(Boolean).join(" ").slice(0, limit);
  }

  function buildInfoTxt(name, author, description, hasTool) {
    // Tags sort the mod in the Steam Workshop. A mod without a tool is a gameplay mod.
    return (
      `name = ${cleanLine(name, 60)}\n` +
      `author = ${cleanLine(author, 60)}\n` +
      `description = ${cleanLine(description, 300)}\n` +
      `tags = ${hasTool ? "Tool" : "Gameplay"}\n`
    );
  }

  const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const b of bytes) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  /** A plain zip (files stored without compression; mods are only a few KB). */
  function makeZip(files) {
    const now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const parts = [];
    const central = [];
    let offset = 0;

    function header(size) {
      const buffer = new Uint8Array(size);
      return { buffer, view: new DataView(buffer.buffer) };
    }

    for (const file of files) {
      const name = encoder.encode(file.name);
      const data = typeof file.data === "string" ? encoder.encode(file.data) : file.data;
      const crc = crc32(data);

      const local = header(30);
      local.view.setUint32(0, 0x04034b50, true);
      local.view.setUint16(4, 20, true);
      local.view.setUint16(6, 0x0800, true); // names are UTF-8
      local.view.setUint16(10, time, true);
      local.view.setUint16(12, date, true);
      local.view.setUint32(14, crc, true);
      local.view.setUint32(18, data.length, true);
      local.view.setUint32(22, data.length, true);
      local.view.setUint16(26, name.length, true);
      parts.push(local.buffer, name, data);

      const entry = header(46);
      entry.view.setUint32(0, 0x02014b50, true);
      entry.view.setUint16(4, 20, true);
      entry.view.setUint16(6, 20, true);
      entry.view.setUint16(8, 0x0800, true);
      entry.view.setUint16(12, time, true);
      entry.view.setUint16(14, date, true);
      entry.view.setUint32(16, crc, true);
      entry.view.setUint32(20, data.length, true);
      entry.view.setUint32(24, data.length, true);
      entry.view.setUint16(28, name.length, true);
      entry.view.setUint32(42, offset, true);
      central.push(entry.buffer, name);

      offset += 30 + name.length + data.length;
    }

    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = header(22);
    end.view.setUint32(0, 0x06054b50, true);
    end.view.setUint16(8, files.length, true);
    end.view.setUint16(10, files.length, true);
    end.view.setUint32(12, centralSize, true);
    end.view.setUint32(16, offset, true);

    const all = [...parts, ...central, end.buffer];
    const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
    let at = 0;
    for (const part of all) {
      out.set(part, at);
      at += part.length;
    }
    return out;
  }

  /**
   * Return { folder, bytes }. The zip holds one folder ready for Teardown's mods folder.
   * defaultVox is the stock tool model (static/vox/tool.vox); it's only added when the mod has a tool.
   * extraFiles are more .vox models to put in the mod folder, each { path, data }.
   */
  function buildModZip({ name, author, description, lua, vox = null, hasTool = true, defaultVox = null, extraFiles = [] }) {
    if (typeof lua !== "string" || !lua.trim()) throw new ModError("empty_mod");
    if (encoder.encode(lua).length > MAX_LUA_BYTES) throw new ModError("too_big");
    if (vox) {
      if (vox.length > MAX_VOX_BYTES) throw new ModError("vox_too_big");
      if (String.fromCharCode(...vox.slice(0, 4)) !== "VOX ") throw new ModError("not_vox");
    }

    name = cleanLine(name, 60) || "My Mod";
    const folder = slugify(name);
    const files = [
      { name: `${folder}/info.txt`, data: buildInfoTxt(name, author, description, hasTool) },
      { name: `${folder}/main.lua`, data: lua },
    ];
    if (hasTool) files.push({ name: `${folder}/vox/tool.vox`, data: vox || defaultVox });
    // More models, such as the things "shoot a ..." blocks shoot: [{ path: "vox/ball.vox", data }].
    for (const file of extraFiles) {
      if (file.data.length > MAX_VOX_BYTES) throw new ModError("vox_too_big");
      if (String.fromCharCode(...file.data.slice(0, 4)) !== "VOX ") throw new ModError("not_vox");
      files.push({ name: `${folder}/${file.path}`, data: file.data });
    }
    return { folder, bytes: makeZip(files) };
  }

  const api = { ModError, slugify, cleanLine, buildModZip, crc32 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Modpack = api;
})(typeof window !== "undefined" ? window : globalThis);
