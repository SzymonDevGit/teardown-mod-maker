// Teardown blocks: how they look, and the Lua code each one writes.
(function () {
  const B = window.APP.t.blocks;
  const C = window.APP.t.categories;
  const L = lua.luaGenerator;
  const O = lua.Order;

  const COLOURS = {
    events: "#e6a01e",
    actions: "#d9534f",
    player: "#4a90d9",
    places: "#3fae7a",
  };

  const KEYS = [
    ["E", "e"], ["F", "f"], ["Q", "q"], ["R", "r"], ["G", "g"],
    ["Z", "z"], ["X", "x"], ["C", "c"], ["V", "v"],
    [B.key_space, "space"], [B.key_lmb, "lmb"], [B.key_rmb, "rmb"],
  ];

  const place = (name) => ({ type: "input_value", name, check: "Place" });
  const number = (name) => ({ type: "input_value", name, check: "Number" });
  const statement = { type: "input_statement", name: "DO" };

  function eventBlock(type, message, args = []) {
    return {
      type,
      message0: message,
      args0: args,
      message1: "%1",
      args1: [statement],
      colour: COLOURS.events,
      hat: "cap",
    };
  }

  function actionBlock(type, colour, message, args = []) {
    return {
      type, message0: message, args0: args, colour,
      previousStatement: null, nextStatement: null, inputsInline: true,
    };
  }

  Blockly.common.defineBlocksWithJsonArray([
    eventBlock("td_when_start", B.when_start),
    eventBlock("td_every_frame", B.every_frame),
    eventBlock("td_when_key", B.when_key, [{ type: "field_dropdown", name: "KEY", options: KEYS }]),
    {
      type: "td_tool",
      message0: B.tool,
      args0: [{ type: "field_input", name: "NAME", text: B.tool_default_name }],
      message1: B.tool_use + " %1",
      args1: [statement],
      colour: COLOURS.events,
      hat: "cap",
    },
    actionBlock("td_explode", COLOURS.actions, B.explode, [place("WHERE"), number("SIZE")]),
    actionBlock("td_hole", COLOURS.actions, B.hole, [place("WHERE"), number("SIZE")]),
    actionBlock("td_fire", COLOURS.actions, B.fire, [place("WHERE")]),
    actionBlock("td_shoot", COLOURS.actions, B.shoot, [{
      type: "field_dropdown", name: "KIND",
      options: [[B.shoot_bullet, "bullet"], [B.shoot_rocket, "rocket"]],
    }]),
    actionBlock("td_message", COLOURS.actions, B.message, [{ type: "input_value", name: "TEXT" }]),
    actionBlock("td_set_health", COLOURS.player, B.set_health, [number("VALUE")]),
    actionBlock("td_launch", COLOURS.player, B.launch, [number("POWER")]),
    actionBlock("td_teleport", COLOURS.player, B.teleport, [place("WHERE")]),
    actionBlock("td_slowmo", COLOURS.player, B.slowmo, [number("SECONDS")]),
    { type: "td_health", message0: B.health, output: "Number", colour: COLOURS.player },
    { type: "td_look_point", message0: B.look_point, output: "Place", colour: COLOURS.places },
    { type: "td_my_pos", message0: B.my_pos, output: "Place", colour: COLOURS.places },
    {
      type: "td_in_front", message0: B.in_front, args0: [number("DIST")],
      output: "Place", colour: COLOURS.places, inputsInline: true,
    },
  ]);

  // ---- Lua helpers, only added to the mod when a block needs them ----

  function lookPointFn() {
    return L.provideFunction_("td_lookPoint", `
function ${L.FUNCTION_NAME_PLACEHOLDER_}()
  local cam = GetCameraTransform()
  local dir = TransformToParentVec(cam, Vec(0, 0, -1))
  local hit, dist = QueryRaycast(cam.pos, dir, 100)
  if not hit then dist = 100 end
  return VecAdd(cam.pos, VecScale(dir, dist))
end`);
  }

  function inFrontFn() {
    return L.provideFunction_("td_inFront", `
function ${L.FUNCTION_NAME_PLACEHOLDER_}(metres)
  local t = GetPlayerTransform()
  local dir = TransformToParentVec(GetCameraTransform(), Vec(0, 0, -1))
  return VecAdd(VecAdd(t.pos, Vec(0, 1.5, 0)), VecScale(dir, metres))
end`);
  }

  const val = (block, name, fallback) => L.valueToCode(block, name, O.NONE) || fallback;
  const where = (block) => val(block, "WHERE", `${lookPointFn()}()`);

  // Event blocks are put together by buildLua, so they write nothing themselves.
  for (const type of ["td_when_start", "td_every_frame", "td_when_key", "td_tool"]) {
    L.forBlock[type] = () => "";
  }

  L.forBlock.td_explode = (b) =>
    `Explosion(${where(b)}, math.max(0.5, math.min(4, ${val(b, "SIZE", "2")})))\n`;
  L.forBlock.td_hole = (b) => {
    const size = val(b, "SIZE", "1");
    return `do local s = ${size} MakeHole(${where(b)}, s, s * 0.7, s * 0.4) end\n`;
  };
  L.forBlock.td_fire = (b) => `SpawnFire(${where(b)})\n`;
  L.forBlock.td_shoot = (b) => {
    const kind = b.getFieldValue("KIND") === "rocket" ? "rocket" : "bullet";
    return `do local cam = GetCameraTransform() Shoot(cam.pos, TransformToParentVec(cam, Vec(0, 0, -1)), "${kind}") end\n`;
  };
  L.forBlock.td_message = (b) => `DebugPrint(tostring(${val(b, "TEXT", '""')}))\n`;
  L.forBlock.td_set_health = (b) =>
    `SetPlayerHealth(math.max(0, math.min(1, (${val(b, "VALUE", "100")}) / 100)))\n`;
  L.forBlock.td_launch = (b) =>
    `do local v = GetPlayerVelocity() SetPlayerVelocity(Vec(v[1], ${val(b, "POWER", "10")}, v[3])) end\n`;
  L.forBlock.td_teleport = (b) => `SetPlayerTransform(Transform(${where(b)}))\n`;
  L.forBlock.td_slowmo = (b) => `td_slowmo = ${val(b, "SECONDS", "3")}\n`;
  L.forBlock.td_health = () => ["(GetPlayerHealth() * 100)", O.ATOMIC];
  L.forBlock.td_look_point = () => [`${lookPointFn()}()`, O.HIGH];
  L.forBlock.td_my_pos = () => ["GetPlayerTransform().pos", O.HIGH];
  L.forBlock.td_in_front = (b) => [`${inFrontFn()}(${val(b, "DIST", "3")})`, O.HIGH];

  function toolId(name, used) {
    let base = name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "tool";
    base = "tmm" + base;
    let id = base;
    for (let n = 2; used.has(id); n++) id = base + n;
    used.add(id);
    return id;
  }

  const luaString = (text) => JSON.stringify(String(text));

  // Turns the whole workspace into one main.lua file.
  window.buildLua = function (workspace) {
    L.init(workspace);
    const init = [];
    const tick = [];
    const toolIds = new Set();
    let unused = 0;

    for (const block of workspace.getTopBlocks(true)) {
      if (!block.isEnabled()) continue;
      const body = L.statementToCode(block, "DO");
      switch (block.type) {
        case "td_when_start":
          init.push(body);
          break;
        case "td_every_frame":
          tick.push(body);
          break;
        case "td_when_key":
          tick.push(`  if InputPressed(${luaString(block.getFieldValue("KEY"))}) then\n${L.prefixLines(body, L.INDENT)}  end\n`);
          break;
        case "td_tool": {
          const name = block.getFieldValue("NAME") || "Tool";
          const id = toolId(name, toolIds);
          init.push(`  RegisterTool("${id}", ${luaString(name)}, "MOD/vox/tool.vox")\n  SetBool("game.tool.${id}.enabled", true)\n`);
          tick.push(
            `  if GetString("game.player.tool") == "${id}" and GetBool("game.player.canusetool") and InputPressed("usetool") then\n` +
            `${L.prefixLines(body, L.INDENT)}  end\n`
          );
          break;
        }
        default:
          unused++;
      }
    }

    const usesSlowmo = workspace.getAllBlocks(false).some((b) => b.type === "td_slowmo" && b.isEnabled());
    if (usesSlowmo) {
      tick.unshift(
        "  if td_slowmo and td_slowmo > 0 then\n" +
        "    td_slowmo = td_slowmo - dt\n" +
        "    SetTimeScale(0.25)\n" +
        "  end\n"
      );
    }

    const helpers = L.finish("").trim();
    const parts = ["-- Made with Teardown Mod Maker"];
    if (unused) parts.push(`-- ${B.unused_comment}`);
    if (usesSlowmo) parts.push("td_slowmo = 0");
    if (helpers) parts.push(helpers);
    parts.push(`function init()\n${init.join("")}end`);
    parts.push(`function tick(dt)\n${tick.join("")}end`);
    return parts.join("\n\n") + "\n";
  };

  window.hasEventBlocks = (workspace) =>
    workspace.getTopBlocks(false).some((b) => b.type.startsWith("td_when") || b.type === "td_every_frame" || b.type === "td_tool");

  const shadowPlace = { shadow: { type: "td_look_point" } };
  const num = (n) => ({ shadow: { type: "math_number", fields: { NUM: n } } });

  window.TOOLBOX = {
    kind: "categoryToolbox",
    contents: [
      {
        kind: "category", name: C.events, colour: COLOURS.events, toolboxitemid: "events",
        contents: [
          { kind: "block", type: "td_tool" },
          { kind: "block", type: "td_when_key" },
          { kind: "block", type: "td_when_start" },
          { kind: "block", type: "td_every_frame" },
        ],
      },
      {
        kind: "category", name: C.actions, colour: COLOURS.actions, toolboxitemid: "actions",
        contents: [
          { kind: "block", type: "td_explode", inputs: { WHERE: shadowPlace, SIZE: num(2) } },
          { kind: "block", type: "td_hole", inputs: { WHERE: shadowPlace, SIZE: num(1) } },
          { kind: "block", type: "td_fire", inputs: { WHERE: shadowPlace } },
          { kind: "block", type: "td_shoot" },
          { kind: "block", type: "td_message", inputs: { TEXT: { shadow: { type: "text", fields: { TEXT: B.message_default } } } } },
        ],
      },
      {
        kind: "category", name: C.player, colour: COLOURS.player, toolboxitemid: "player",
        contents: [
          { kind: "block", type: "td_launch", inputs: { POWER: num(10) } },
          { kind: "block", type: "td_teleport", inputs: { WHERE: shadowPlace } },
          { kind: "block", type: "td_set_health", inputs: { VALUE: num(100) } },
          { kind: "block", type: "td_health" },
          { kind: "block", type: "td_slowmo", inputs: { SECONDS: num(3) } },
        ],
      },
      {
        kind: "category", name: C.places, colour: COLOURS.places, toolboxitemid: "places",
        contents: [
          { kind: "block", type: "td_look_point" },
          { kind: "block", type: "td_my_pos" },
          { kind: "block", type: "td_in_front", inputs: { DIST: num(3) } },
        ],
      },
      { kind: "sep" },
      {
        kind: "category", name: C.logic, categorystyle: "logic_category", toolboxitemid: "logic",
        contents: [
          { kind: "block", type: "controls_if" },
          { kind: "block", type: "logic_compare" },
          { kind: "block", type: "logic_operation" },
          { kind: "block", type: "logic_boolean" },
        ],
      },
      {
        kind: "category", name: C.loops, categorystyle: "loop_category", toolboxitemid: "loops",
        contents: [{ kind: "block", type: "controls_repeat_ext", inputs: { TIMES: num(3) } }],
      },
      {
        kind: "category", name: C.math, categorystyle: "math_category", toolboxitemid: "math",
        contents: [
          { kind: "block", type: "math_number" },
          { kind: "block", type: "math_arithmetic", inputs: { A: num(1), B: num(1) } },
          { kind: "block", type: "math_random_int", inputs: { FROM: num(1), TO: num(10) } },
        ],
      },
      {
        kind: "category", name: C.text, categorystyle: "text_category", toolboxitemid: "text",
        contents: [{ kind: "block", type: "text" }],
      },
      { kind: "category", name: C.variables, categorystyle: "variable_category", custom: "VARIABLE", toolboxitemid: "variables" },
    ],
  };

  // Which help entry ("term") explains each block, for the hold-T help.
  window.BLOCK_TERMS = {
    td_when_start: "when_start", td_every_frame: "every_frame", td_when_key: "when_key", td_tool: "tool",
    td_explode: "explode", td_hole: "hole", td_fire: "fire", td_shoot: "shoot", td_message: "message",
    td_set_health: "set_health", td_health: "health", td_launch: "launch", td_teleport: "teleport",
    td_slowmo: "slowmo", td_look_point: "look_point", td_my_pos: "my_pos", td_in_front: "in_front",
    controls_if: "if", logic_compare: "compare", logic_operation: "and_or", logic_boolean: "true_false",
    controls_repeat_ext: "repeat", math_number: "number", math_arithmetic: "arithmetic",
    math_random_int: "random", text: "text", variables_set: "variable_set", variables_get: "variable_get",
  };

  // The starter mod: a tool that blows things up where you look.
  window.STARTER = {
    blocks: {
      languageVersion: 0,
      blocks: [{
        type: "td_tool", x: 40, y: 40,
        fields: { NAME: B.tool_default_name },
        inputs: {
          DO: {
            block: {
              type: "td_explode",
              inputs: { WHERE: { shadow: { type: "td_look_point" } }, SIZE: num(2) },
            },
          },
        },
      }],
    },
  };
})();
