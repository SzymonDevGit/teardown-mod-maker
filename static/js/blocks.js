// Teardown blocks: how they look, and the Lua code each one writes.
// Generated mods are classic singleplayer scripts (global init/tick/draw, no "#version 2"),
// so every call below uses the singleplayer argument lists from Teardown's scripting API.
(function () {
  const B = window.APP.t.blocks;
  const C = window.APP.t.categories;
  const L = lua.luaGenerator;
  const O = lua.Order;

  // Blockly's own word on the "My blocks" blocks, so it matches the hold-T help.
  Blockly.Msg.PROCEDURES_DEFNORETURN_TITLE = B.my_block;
  Blockly.Msg.PROCEDURES_DEFRETURN_TITLE = B.my_block;
  // No "Describe this function..." note on every new My block.
  Blockly.Msg.PROCEDURES_DEFNORETURN_COMMENT = "";
  Blockly.Msg.PROCEDURES_DEFRETURN_COMMENT = "";

  const COLOURS = {
    events: "#c98a00",
    actions: "#b8352b",
    player: "#2f6fb5",
    places: "#2f7d4f",
    timers: "#e06a10",
    screen: "#6b4fa0",
    objects: "#8a5a2b",
    effects: "#1f8a8a",
  };

  // No number keys: Teardown uses them to switch tools, so the kid's tool would be put away.
  // Keys the game also uses say so in their label (E, F, Space and the mouse buttons).
  const KEYS = [
    [B.key_e, "e"], [B.key_f, "f"], ["Q", "q"], ["R", "r"], ["G", "g"],
    ["Z", "z"], ["X", "x"], ["C", "c"], ["V", "v"], ["H", "h"], ["B", "b"], ["N", "n"],
    [B.key_space, "space"], [B.key_shift, "shift"], [B.key_lmb, "lmb"], [B.key_rmb, "rmb"],
  ];

  const LIGHT_COLOURS = {
    white: [1, 1, 1], red: [1, 0.15, 0.1], orange: [1, 0.5, 0.1], yellow: [1, 0.9, 0.2],
    green: [0.2, 1, 0.3], blue: [0.2, 0.4, 1], purple: [0.7, 0.2, 1],
  };

  // Gravity in metres per second squared, pointing up (+) or down (-). Normal is -10.
  const GRAVITY = { normal: -10, moon: -1.6, heavy: -25, upside_down: 4 };

  const place = (name) => ({ type: "input_value", name, check: "Place" });
  const number = (name) => ({ type: "input_value", name, check: "Number" });
  const statement = { type: "input_statement", name: "DO" };
  const dropdown = (name, options) => ({ type: "field_dropdown", name, options });

  function eventBlock(type, message, args = []) {
    return { type, message0: message, args0: args, message1: "%1", args1: [statement], colour: COLOURS.events, hat: "cap" };
  }

  function actionBlock(type, colour, message, args = []) {
    return {
      type, message0: message, args0: args, colour,
      previousStatement: null, nextStatement: null, inputsInline: true,
    };
  }

  function valueBlock(type, colour, message, output, args = []) {
    return { type, message0: message, args0: args, output, colour, inputsInline: true };
  }

  Blockly.common.defineBlocksWithJsonArray([
    // Events
    eventBlock("td_when_start", B.when_start),
    eventBlock("td_every_frame", B.every_frame),
    eventBlock("td_when_key", B.when_key, [dropdown("KEY", KEYS)]),
    eventBlock("td_every_seconds", B.every_seconds, [
      { type: "field_number", name: "SECONDS", value: 1, min: 0.1, max: 3600, precision: 0.1 },
    ]),
    {
      type: "td_tool",
      message0: B.tool,
      args0: [{ type: "field_input", name: "NAME", text: B.tool_default_name }],
      message1: B.tool_use + " %1",
      args1: [statement],
      colour: COLOURS.events,
      hat: "cap",
    },

    // Actions
    actionBlock("td_explode", COLOURS.actions, B.explode, [place("WHERE"), number("SIZE")]),
    actionBlock("td_hole", COLOURS.actions, B.hole, [place("WHERE"), number("SIZE")]),
    actionBlock("td_fire", COLOURS.actions, B.fire, [place("WHERE")]),
    actionBlock("td_shoot", COLOURS.actions, B.shoot, [
      dropdown("KIND", [[B.shoot_bullet, "bullet"], [B.shoot_rocket, "rocket"], [B.shoot_shotgun, "shotgun"]]),
    ]),
    actionBlock("td_paint", COLOURS.actions, B.paint, [
      dropdown("KIND", [[B.paint_spray, "spraycan"], [B.paint_scorch, "explosion"]]), place("WHERE"), number("SIZE"),
    ]),
    actionBlock("td_shake", COLOURS.actions, B.shake, [
      dropdown("STRENGTH", [[B.shake_small, "0.3"], [B.shake_medium, "0.6"], [B.shake_big, "1"]]),
    ]),
    actionBlock("td_sound", COLOURS.actions, B.sound, [
      dropdown("SOUND", [
        // Teardown's own sounds. A name ending in 0 plays a random one of a numbered set (gun0, gun1, ...).
        [B.sound_beep, "warning-beep.ogg"], [B.sound_gun, "tools/gun0.ogg"],
        [B.sound_launcher, "tools/launcher0.ogg"], [B.sound_metal, "metal/hit-s0.ogg"],
      ]),
    ]),
    actionBlock("td_message", COLOURS.actions, B.message, [{ type: "input_value", name: "TEXT" }]),

    // Player
    actionBlock("td_launch", COLOURS.player, B.launch, [number("POWER")]),
    actionBlock("td_push_me", COLOURS.player, B.push_me, [
      dropdown("DIR", [[B.dir_forward, "forward"], [B.dir_back, "back"], [B.dir_left, "left"], [B.dir_right, "right"], [B.dir_up, "up"]]),
      number("POWER"),
    ]),
    actionBlock("td_teleport", COLOURS.player, B.teleport, [place("WHERE")]),
    actionBlock("td_set_health", COLOURS.player, B.set_health, [number("VALUE")]),
    actionBlock("td_change_health", COLOURS.player, B.change_health, [number("VALUE")]),
    actionBlock("td_slowmo", COLOURS.player, B.slowmo, [number("SECONDS")]),
    actionBlock("td_regen", COLOURS.player, B.regen, [dropdown("ON", [[B.regen_off, "off"], [B.regen_on, "on"]])]),
    valueBlock("td_health", COLOURS.player, B.health, "Number"),
    valueBlock("td_speed", COLOURS.player, B.speed, "Number"),
    valueBlock("td_key_held", COLOURS.player, B.key_held, "Boolean", [dropdown("KEY", KEYS)]),
    valueBlock("td_on_ground", COLOURS.player, B.on_ground, "Boolean"),

    // Places
    valueBlock("td_look_point", COLOURS.places, B.look_point, "Place"),
    valueBlock("td_my_pos", COLOURS.places, B.my_pos, "Place"),
    valueBlock("td_in_front", COLOURS.places, B.in_front, "Place", [number("DIST")]),
    valueBlock("td_above", COLOURS.places, B.above, "Place", [number("DIST"), place("WHERE")]),
    valueBlock("td_random_near", COLOURS.places, B.random_near, "Place", [number("DIST"), place("WHERE")]),

    // Advanced: timers
    {
      type: "td_after",
      message0: B.after,
      args0: [number("SECONDS")],
      message1: "%1",
      args1: [statement],
      colour: COLOURS.timers,
      previousStatement: null,
      nextStatement: null,
      inputsInline: true,
    },
    valueBlock("td_time", COLOURS.timers, B.time, "Number"),

    // Advanced: screen
    actionBlock("td_screen_text", COLOURS.screen, B.screen_text, [
      { type: "input_value", name: "TEXT" },
      dropdown("SPOT", [[B.spot_top, "top"], [B.spot_middle, "middle"], [B.spot_bottom, "bottom"]]),
    ]),
    actionBlock("td_clear_screen", COLOURS.screen, B.clear_screen),
    actionBlock("td_filter", COLOURS.screen, B.filter, [
      dropdown("FILTER", [[B.filter_normal, "normal"], [B.filter_grey, "grey"], [B.filter_old, "old"]]),
    ]),

    // Advanced: objects
    actionBlock("td_push_thing", COLOURS.objects, B.push_thing, [number("POWER")]),
    actionBlock("td_delete_thing", COLOURS.objects, B.delete_thing),
    actionBlock("td_spawn_box", COLOURS.objects, B.spawn_box, [
      dropdown("MATERIAL", [[B.mat_wood, "wood"], [B.mat_metal, "metal"], [B.mat_glass, "glass"], [B.mat_brick, "masonry"], [B.mat_plastic, "plastic"]]),
      number("SIZE"), place("WHERE"),
    ]),
    actionBlock("td_gravity", COLOURS.objects, B.gravity, [
      dropdown("GRAVITY", [[B.gravity_normal, "normal"], [B.gravity_moon, "moon"], [B.gravity_heavy, "heavy"], [B.gravity_upside_down, "upside_down"]]),
    ]),
    valueBlock("td_looking_at_thing", COLOURS.objects, B.looking_at_thing, "Boolean"),

    // Advanced: effects
    actionBlock("td_light", COLOURS.effects, B.light, [
      dropdown("COLOUR", Object.keys(LIGHT_COLOURS).map((key) => [B["colour_" + key], key])), place("WHERE"),
    ]),
    actionBlock("td_lights_off", COLOURS.effects, B.lights_off),
    actionBlock("td_particles", COLOURS.effects, B.particles, [
      dropdown("KIND", [[B.particles_smoke, "smoke"], [B.particles_sparks, "sparks"]]), place("WHERE"),
    ]),
    actionBlock("td_rain", COLOURS.effects, B.rain, [dropdown("ON", [[B.rain_on, "on"], [B.rain_off, "off"]])]),
  ]);

  // ---- Lua helpers, only added to the mod when a block needs them ----

  // Things a block needs in init(), tick() or draw(), collected while generating.
  let needs = new Set();

  // Global names the helpers use, so a kid's variable can't clash with them.
  L.addReservedWords("td_slowmo,td_timers,td_screen,td_messages,td_tools,td_lights,td_sounds,td_every,td_depth,td_aim,td_frame,td_started,td_colours,dt");

  // "My blocks" become Lua functions named by the kid. Make sure no name takes over a Teardown callback
  // (a My block called "update" would run by itself every frame) or a game function the mod calls
  // (a My block called "Explosion" that explodes would call itself forever). Blockly adds a number instead.
  const TEARDOWN_NAMES = [
    "init", "tick", "update", "draw", "handleCommand", "render", "postUpdate",
    "ApplyBodyImpulse", "DebugPrint", "Delete", "Explosion", "GetBodyMass", "GetBool", "GetCameraTransform",
    "GetPlayerHealth", "GetPlayerTransform", "GetPlayerVehicle", "GetPlayerVelocity", "GetPostProcessingProperty",
    "GetShapeBody", "GetString", "GetTime",
    "InputDown", "InputPressed", "IsBodyDynamic", "IsHandleValid", "IsPlayerGrounded", "LoadSound", "MakeHole", "Paint",
    "ParticleColor", "ParticleEmissive", "ParticleGravity", "ParticleRadius", "ParticleReset", "ParticleType",
    "PlaySound", "PointLight", "QueryRaycast", "QueryRejectVehicle", "RegisterTool", "SetBool",
    "SetEnvironmentProperty", "SetGravity", "SetPlayerHealth", "SetPlayerTransform", "SetPlayerVelocity",
    "SetPlayerRegenerationState", "SetPostProcessingProperty", "SetTimeScale", "ShakeCamera", "Shoot", "Spawn", "SpawnFire", "SpawnParticle",
    "Transform", "TransformToParentVec", "UiAlign", "UiCenter", "UiColor", "UiFont", "UiHeight", "UiPop",
    "UiPush", "UiText", "UiTextOutline", "UiTranslate", "Vec", "VecAdd", "VecLength", "VecScale",
  ];
  L.addReservedWords(TEARDOWN_NAMES.join(","));

  const safeName = Blockly.Names.prototype.safeName;
  Blockly.Names.prototype.safeName = function (name) {
    const plain = String(name).replace(/ł/g, "l").replace(/Ł/g, "L").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    return safeName.call(this, plain);
  };

  const helper = (name, code) => L.provideFunction_(name, code.replace("FN", L.FUNCTION_NAME_PLACEHOLDER_));

  // What is in the middle of the screen: the spot, which way that surface faces, the moving object there
  // (0 if none) and the look direction. Worked out once per frame, so every block in a frame means the
  // same spot, even after an explosion has blown away the thing I was looking at.
  const aimFn = () => {
    needs.add("aim");
    return helper("td_aimNow", `
function FN()
  if not td_aim then
    local cam = GetCameraTransform()
    local dir = TransformToParentVec(cam, Vec(0, 0, -1))
    -- Look past the car I'm driving.
    local vehicle = GetPlayerVehicle()
    if vehicle ~= 0 then QueryRejectVehicle(vehicle) end
    local hit, dist, normal, shape = QueryRaycast(cam.pos, dir, 100)
    local body = 0
    if hit then
      body = GetShapeBody(shape)
      if body ~= 0 and not IsBodyDynamic(body) then body = 0 end
    else
      dist = 100
      normal = VecScale(dir, -1)
    end
    td_aim = { point = VecAdd(cam.pos, VecScale(dir, dist)), normal = normal, body = body, dir = dir }
  end
  return td_aim
end`);
  };

  const lookPointFn = () => {
    const aim = aimFn();
    return helper("td_lookPoint", `
function FN()
  return ${aim}().point
end`);
  };

  // A spot some metres ahead of my eyes. It stops just before a wall or floor instead of going through it.
  const inFrontFn = () => helper("td_inFront", `
function FN(metres)
  local cam = GetCameraTransform()
  local dir = TransformToParentVec(cam, Vec(0, 0, -1))
  local from = cam.pos
  if metres < 0 then
    dir = VecScale(dir, -1)
    metres = -metres
  end
  -- In a car the camera is behind it, so measure from me and look past the car.
  local vehicle = GetPlayerVehicle()
  if vehicle ~= 0 then
    from = VecAdd(GetPlayerTransform().pos, Vec(0, 1.5, 0))
    QueryRejectVehicle(vehicle)
  end
  local hit, dist = QueryRaycast(from, dir, metres)
  if hit then metres = math.max(0, dist - 0.3) end
  return VecAdd(from, VecScale(dir, metres))
end`);

  const randomNearFn = () => helper("td_randomNear", `
function FN(metres, pos)
  local angle = math.random() * math.pi * 2
  local dist = math.random() * metres
  return VecAdd(pos, Vec(math.cos(angle) * dist, 0, math.sin(angle) * dist))
end`);

  // The moving object in the middle of the screen: body handle (0 if none), hit point, look direction.
  const lookTargetFn = () => {
    const aim = aimFn();
    return helper("td_lookTarget", `
function FN()
  local aim = ${aim}()
  -- It may have been deleted earlier in this frame.
  if aim.body ~= 0 and IsHandleValid(aim.body) then
    return aim.body, aim.point, aim.dir
  end
  return 0
end`);
  };

  const pushTargetFn = () => {
    const target = lookTargetFn();
    return helper("td_pushTarget", `
function FN(power)
  local body, point, dir = ${target}()
  if body ~= 0 then
    ApplyBodyImpulse(body, point, VecScale(dir, power * GetBodyMass(body)))
  end
end`);
  };

  const pushMeFn = () => helper("td_pushMe", `
function FN(direction, power)
  local t = GetPlayerTransform()
  local dirs = { forward = Vec(0, 0, -1), back = Vec(0, 0, 1), left = Vec(-1, 0, 0), right = Vec(1, 0, 0) }
  local dir = Vec(0, 1, 0)
  if dirs[direction] then dir = TransformToParentVec(t, dirs[direction]) end
  SetPlayerVelocity(VecAdd(GetPlayerVelocity(), VecScale(dir, power)))
end`);

  const spawnBoxFn = () => {
    const aim = aimFn();
    return helper("td_spawnBox", `
function FN(material, metres, pos, onSurface)
  local voxels = math.max(1, math.min(50, math.floor(metres * 10 + 0.5)))
  local half = voxels * 0.05
  local centre
  if onSurface then
    -- Push the box out of the wall, floor or ceiling I'm looking at, whatever the angle.
    local n = ${aim}().normal
    centre = VecAdd(pos, VecScale(n, half * (math.abs(n[1]) + math.abs(n[2]) + math.abs(n[3])) + 0.05))
    -- Unless it's a ceiling, start no lower than the spot, so a big box doesn't sink into the floor.
    if n[2] > -0.5 then centre[2] = math.max(centre[2], pos[2] + half + 0.05) end
  else
    -- Sit the box on top of the spot.
    centre = VecAdd(pos, Vec(0, half + 0.05, 0))
  end
  local xml = "<voxbox size='" .. voxels .. " " .. voxels .. " " .. voxels .. "' prop='true' material='" .. material .. "'/>"
  Spawn(xml, Transform(VecAdd(centre, Vec(-half, -half, -half))))
end`);
  };

  const playSoundFn = () => {
    needs.add("sounds");
    return helper("td_playSound", `
function FN(name)
  if not td_sounds[name] then td_sounds[name] = LoadSound(name) end
  PlaySound(td_sounds[name])
end`);
  };

  const afterFn = () => {
    needs.add("timers");
    return helper("td_after", `
function FN(seconds, action)
  if #td_timers < 200 then
    table.insert(td_timers, { time = GetTime() + seconds, action = action })
  end
end`);
  };

  const particlesFn = () => helper("td_particles", `
function FN(kind, pos)
  ParticleReset()
  if kind == "smoke" then
    ParticleType("smoke")
    ParticleColor(0.6, 0.6, 0.6)
    ParticleRadius(0.4, 1.0)
  else
    ParticleType("plain")
    ParticleColor(1, 0.8, 0.3, 1, 0.3, 0)
    ParticleRadius(0.05)
    ParticleEmissive(5, 0)
    ParticleGravity(-10)
  end
  for i = 1, 20 do
    local velocity = Vec(math.random() * 4 - 2, math.random() * 4, math.random() * 4 - 2)
    SpawnParticle(pos, velocity, kind == "smoke" and 3 or 1)
  end
end`);

  const val = (block, name, fallback) => L.valueToCode(block, name, O.NONE) || fallback;

  // Variables and My blocks can hold anything (variables start at 0, and a kid may store text).
  // Number and place inputs only trust blocks that always give a number or a place;
  // anything else is checked when the mod runs, so a wrong value can't crash it.
  const gives = (block, name, type) => {
    const target = block.getInputTargetBlock(name);
    const check = target && target.outputConnection && target.outputConnection.getCheck();
    return Boolean(check && check.includes(type));
  };
  const numberIn = (block, name, fallback, order = O.NONE) => {
    const code = L.valueToCode(block, name, gives(block, name, "Number") ? order : O.NONE);
    if (!code) return fallback;
    return gives(block, name, "Number") ? code : `(tonumber(${code}) or ${fallback})`;
  };
  const placeFn = () => helper("td_place", `
function FN(pos)
  if type(pos) == "table" and type(pos[1]) == "number" and type(pos[2]) == "number" and type(pos[3]) == "number" then
    return pos
  end
  return ${lookPointFn()}()
end`);
  const where = (block) => {
    const code = L.valueToCode(block, "WHERE", O.NONE);
    if (!code) return `${lookPointFn()}()`;
    return gives(block, "WHERE", "Place") ? code : `${placeFn()}(${code})`;
  };
  const luaString = (text) => JSON.stringify(String(text));
  const clamp = (code, min, max) => `math.max(${min}, math.min(${max}, ${code}))`;

  // Event blocks are put together by buildLua, so they write nothing themselves.
  const EVENT_TYPES = new Set(["td_when_start", "td_every_frame", "td_when_key", "td_every_seconds", "td_tool"]);
  for (const type of EVENT_TYPES) L.forBlock[type] = () => "";

  // Actions
  L.forBlock.td_explode = (b) => `Explosion(${where(b)}, ${clamp(numberIn(b, "SIZE", "2"), 0.5, 4)})\n`;
  L.forBlock.td_hole = (b) => `do local td_s = ${clamp(numberIn(b, "SIZE", "1"), 0, 5)} MakeHole(${where(b)}, td_s, td_s * 0.7, td_s * 0.4) end\n`;
  L.forBlock.td_fire = (b) => `SpawnFire(${where(b)})\n`;
  L.forBlock.td_shoot = (b) => {
    const kind = ["bullet", "rocket", "shotgun"].includes(b.getFieldValue("KIND")) ? b.getFieldValue("KIND") : "bullet";
    // Start 1 m in front of the camera: from the camera itself a rocket hits the player (or the held tool) and blows up on them.
    return `do local cam = GetCameraTransform() local td_d = TransformToParentVec(cam, Vec(0, 0, -1)) Shoot(VecAdd(cam.pos, td_d), td_d, "${kind}") end\n`;
  };
  L.forBlock.td_paint = (b) => {
    const kind = b.getFieldValue("KIND") === "explosion" ? "explosion" : "spraycan";
    return `Paint(${where(b)}, ${clamp(numberIn(b, "SIZE", "1"), 0, 5)}, "${kind}")\n`;
  };
  L.forBlock.td_shake = (b) => `ShakeCamera(${Number(b.getFieldValue("STRENGTH")) || 0.5})\n`;
  L.forBlock.td_sound = (b) => `${playSoundFn()}(${luaString(b.getFieldValue("SOUND"))})\n`;
  // Messages are drawn by the mod (not DebugPrint), so they can fade and hide while the mod's tool isn't held.
  const sayFn = () => helper("td_say", `
function FN(text)
  table.insert(td_messages, { text = tostring(text), time = GetTime() })
  if #td_messages > 5 then table.remove(td_messages, 1) end
end`);
  L.forBlock.td_message = (b) => {
    needs.add("messages");
    return `${sayFn()}(${val(b, "TEXT", '""')})\n`;
  };

  // Player (health in Teardown goes from 0 to 1; the blocks use 0 to 100 so it reads like a percent)
  L.forBlock.td_launch = (b) =>
    `do local td_v = GetPlayerVelocity() SetPlayerVelocity(Vec(td_v[1], ${clamp(numberIn(b, "POWER", "10"), -100, 100)}, td_v[3])) end\n`;
  L.forBlock.td_push_me = (b) => `${pushMeFn()}(${luaString(b.getFieldValue("DIR"))}, ${clamp(numberIn(b, "POWER", "10"), -100, 100)})\n`;
  // Keep the way the player is facing, or every teleport would turn the camera.
  L.forBlock.td_teleport = (b) => `SetPlayerTransform(Transform(${where(b)}, GetPlayerTransform().rot))\n`;
  L.forBlock.td_set_health = (b) => `SetPlayerHealth(${clamp(`(${numberIn(b, "VALUE", "100")}) / 100`, 0, 1)})\n`;
  L.forBlock.td_change_health = (b) =>
    `SetPlayerHealth(${clamp(`GetPlayerHealth() + (${numberIn(b, "VALUE", "10")}) / 100`, 0, 1)})\n`;
  // td_slowmo is the time slow motion ends, on the same clock as "after" and "every N seconds".
  L.forBlock.td_slowmo = (b) => {
    needs.add("slowmo");
    return `td_slowmo = GetTime() + ${numberIn(b, "SECONDS", "3", O.ADDITIVE)}\n`;
  };
  // Teardown slowly heals the player by itself. Turning that off keeps damage from lava or "change my health" blocks.
  L.forBlock.td_regen = (b) => `SetPlayerRegenerationState(${b.getFieldValue("ON") === "on" ? "true" : "false"})\n`;
  // Rounded to a whole number, so "my health = 100" works and messages don't show long decimals.
  L.forBlock.td_health = () => ["math.floor(GetPlayerHealth() * 100 + 0.5)", O.HIGH];
  L.forBlock.td_speed = () => ["(math.floor(VecLength(GetPlayerVelocity()) * 10 + 0.5) / 10)", O.ATOMIC];
  L.forBlock.td_key_held = (b) => [`InputDown(${luaString(b.getFieldValue("KEY"))})`, O.HIGH];
  L.forBlock.td_on_ground = () => ["IsPlayerGrounded()", O.HIGH];

  // Places
  L.forBlock.td_look_point = () => [`${lookPointFn()}()`, O.HIGH];
  L.forBlock.td_my_pos = () => ["GetPlayerTransform().pos", O.HIGH];
  L.forBlock.td_in_front = (b) => [`${inFrontFn()}(${clamp(numberIn(b, "DIST", "3"), -100, 100)})`, O.HIGH];
  L.forBlock.td_above = (b) => [`VecAdd(${where(b)}, Vec(0, ${clamp(numberIn(b, "DIST", "2"), -100, 100)}, 0))`, O.HIGH];
  L.forBlock.td_random_near = (b) => [`${randomNearFn()}(${clamp(numberIn(b, "DIST", "5"), 0, 100)}, ${where(b)})`, O.HIGH];

  // Timers
  L.forBlock.td_after = (b) => `${afterFn()}(${numberIn(b, "SECONDS", "1")}, function()\n${L.statementToCode(b, "DO")}end)\n`;
  L.forBlock.td_time = () => ["(math.floor(GetTime() * 10 + 0.5) / 10)", O.ATOMIC];

  // Screen
  // Remembers when the words last changed, so mods without a tool can fade them out a few seconds later.
  const showFn = () => helper("td_show", `
function FN(spot, text)
  text = tostring(text)
  if td_screen[spot] == nil or td_screen[spot].text ~= text then
    td_screen[spot] = { text = text, time = GetTime() }
  end
end`);
  L.forBlock.td_screen_text = (b) => {
    needs.add("screen");
    const spot = ["top", "middle", "bottom"].includes(b.getFieldValue("SPOT")) ? b.getFieldValue("SPOT") : "middle";
    return `${showFn()}("${spot}", ${val(b, "TEXT", '""')})\n`;
  };
  L.forBlock.td_clear_screen = () => {
    needs.add("screen");
    return "td_screen = {}\n";
  };
  // The first time a filter is used, remember the level's own colours, so "normal" puts them back
  // instead of resetting the level's look.
  const filterFn = () => helper("td_filter", `
function FN(kind)
  if not td_colours then
    local r, g, b = GetPostProcessingProperty("colorbalance")
    td_colours = { saturation = GetPostProcessingProperty("saturation") or 1, r = r or 1, g = g or 1, b = b or 1 }
  end
  local level = td_colours
  if kind == "grey" then
    SetPostProcessingProperty("saturation", 0)
    SetPostProcessingProperty("colorbalance", level.r, level.g, level.b)
  elseif kind == "old" then
    SetPostProcessingProperty("saturation", 0.4)
    SetPostProcessingProperty("colorbalance", 1.3, 1.0, 0.7)
  else
    SetPostProcessingProperty("saturation", level.saturation)
    SetPostProcessingProperty("colorbalance", level.r, level.g, level.b)
  end
end`);
  L.forBlock.td_filter = (b) => {
    const kind = ["grey", "old"].includes(b.getFieldValue("FILTER")) ? b.getFieldValue("FILTER") : "normal";
    return `${filterFn()}("${kind}")\n`;
  };

  // Objects
  L.forBlock.td_push_thing = (b) => `${pushTargetFn()}(${clamp(numberIn(b, "POWER", "10"), -100, 100)})\n`;
  L.forBlock.td_delete_thing = () => `do local body = ${lookTargetFn()}() if body ~= 0 then Delete(body) end end\n`;
  L.forBlock.td_spawn_box = (b) => {
    const material = ["wood", "metal", "glass", "masonry", "plastic"].includes(b.getFieldValue("MATERIAL"))
      ? b.getFieldValue("MATERIAL") : "wood";
    const target = b.getInputTargetBlock("WHERE");
    const onSurface = !target || target.type === "td_look_point";
    return `${spawnBoxFn()}("${material}", ${numberIn(b, "SIZE", "1")}, ${where(b)}, ${onSurface})\n`;
  };
  L.forBlock.td_gravity = (b) => `SetGravity(Vec(0, ${GRAVITY[b.getFieldValue("GRAVITY")] ?? -10}, 0))\n`;
  L.forBlock.td_looking_at_thing = () => [`(${lookTargetFn()}() ~= 0)`, O.ATOMIC];

  // Effects
  L.forBlock.td_light = (b) => {
    needs.add("lights");
    const [r, g, bl] = LIGHT_COLOURS[b.getFieldValue("COLOUR")] || LIGHT_COLOURS.white;
    // At most 50 lights: a new one replaces the oldest.
    return `if #td_lights >= 50 then table.remove(td_lights, 1) end\n` +
      `table.insert(td_lights, { pos = ${where(b)}, r = ${r}, g = ${g}, b = ${bl} })\n`;
  };
  L.forBlock.td_lights_off = () => {
    needs.add("lights");
    return "td_lights = {}\n";
  };
  L.forBlock.td_particles = (b) =>
    `${particlesFn()}("${b.getFieldValue("KIND") === "sparks" ? "sparks" : "smoke"}", ${where(b)})\n`;
  L.forBlock.td_rain = (b) => {
    const amount = b.getFieldValue("ON") === "on" ? "0.8" : "0";
    return `SetEnvironmentProperty("rain", ${amount})\nSetEnvironmentProperty("wetness", ${amount})\n`;
  };

  // Kids often add to a score before setting it, and join numbers into text.
  // Blockly's Lua for these crashes on a variable that has no value yet, so make them forgiving.
  L.forBlock.math_change = (b) => {
    const name = L.getVariableName(b.getFieldValue("VAR"));
    return `${name} = (tonumber(${name}) or 0) + ${L.valueToCode(b, "DELTA", O.ADDITIVE) || "0"}\n`;
  };
  L.forBlock.text_join = (b) => {
    const parts = [];
    for (let i = 0; i < b.itemCount_; i++) {
      parts.push(`tostring(${L.valueToCode(b, "ADD" + i, O.NONE) || "''"})`);
    }
    return parts.length ? [parts.join(" .. "), O.CONCATENATION] : ["''", O.ATOMIC];
  };

  // Maths and "bigger than" only work on numbers, so a variable holding text counts as 0 instead of crashing.
  const ARITHMETIC = {
    ADD: [" + ", O.ADDITIVE], MINUS: [" - ", O.ADDITIVE], MULTIPLY: [" * ", O.MULTIPLICATIVE],
    DIVIDE: [" / ", O.MULTIPLICATIVE], POWER: [" ^ ", O.EXPONENTIATION],
  };
  L.forBlock.math_arithmetic = (b) => {
    const [op, order] = ARITHMETIC[b.getFieldValue("OP")] || ARITHMETIC.ADD;
    return [numberIn(b, "A", "0", order) + op + numberIn(b, "B", "0", order), order];
  };
  const compareText = L.forBlock.logic_compare;
  L.forBlock.logic_compare = (b, generator) => {
    const op = { LT: "<", LTE: "<=", GT: ">", GTE: ">=" }[b.getFieldValue("OP")];
    if (!op) return compareText(b, generator);
    return [`${numberIn(b, "A", "0", O.RELATIONAL)} ${op} ${numberIn(b, "B", "0", O.RELATIONAL)}`, O.RELATIONAL];
  };
  // Lua's math.random stops the mod if "from" is bigger than "to", so swap them.
  const randomFn = () => helper("td_random", `
function FN(from, to)
  from, to = math.floor(from), math.floor(to)
  if from > to then from, to = to, from end
  return math.random(from, to)
end`);
  L.forBlock.math_random_int = (b) => [`${randomFn()}(${numberIn(b, "FROM", "1")}, ${numberIn(b, "TO", "10")})`, O.HIGH];
  L.forBlock.controls_repeat_ext = (b) => {
    const times = numberIn(b, "TIMES", "0");
    const count = L.nameDB_.getDistinctName("count", Blockly.Names.NameType.VARIABLE);
    const body = L.addLoopTrap(L.statementToCode(b, "DO"), b);
    // At most 100 times, so "repeat 100000 times: explode" can't freeze the game.
    const limit = /^\d+$/.test(times) ? String(Math.min(Number(times), 100)) : `math.min(100, math.floor(${times}))`;
    return `for ${count} = 1, ${limit} do\n${body}end\n`;
  };

  // A My block that uses itself (or goes round through other My blocks) would never stop and crash the mod.
  // Calls to such blocks go through td_call, which stops 100 levels deep.
  let loopingBlocks = new Set();
  const callGuardFn = () => {
    needs.add("calls");
    return helper("td_call", `
function FN(myBlock, ...)
  if td_depth >= 100 then return 0 end
  td_depth = td_depth + 1
  local result = myBlock(...)
  td_depth = td_depth - 1
  return result
end`);
  };
  const callMyBlock = L.forBlock.procedures_callreturn;
  L.forBlock.procedures_callreturn = (b, generator) => {
    const [code, order] = callMyBlock(b, generator);
    if (!loopingBlocks.has(b.getFieldValue("NAME"))) return [code, order];
    const open = code.indexOf("(");
    const args = code.slice(open + 1, -1);
    return [`${callGuardFn()}(${code.slice(0, open)}${args ? ", " + args : ""})`, O.HIGH];
  };

  // Names of the My blocks that can end up using themselves.
  function findLoopingBlocks(workspace) {
    const uses = new Map();
    for (const def of workspace.getTopBlocks(false)) {
      if (!def.type.startsWith("procedures_def")) continue;
      const called = def.getDescendants(false)
        .filter((b) => b.type.startsWith("procedures_call"))
        .map((b) => b.getFieldValue("NAME"));
      uses.set(def.getFieldValue("NAME"), called);
    }
    const looping = new Set();
    for (const start of uses.keys()) {
      const seen = new Set();
      const stack = [...(uses.get(start) || [])];
      while (stack.length) {
        const name = stack.pop();
        if (name === start) { looping.add(start); break; }
        if (seen.has(name)) continue;
        seen.add(name);
        stack.push(...(uses.get(name) || []));
      }
    }
    return looping;
  }

  // Polish letters become plain ones (ż -> z), so "Różdżka" becomes "rozdzka", not "rdka".
  const plainId = (text) =>
    String(text).toLowerCase().replace(/ł/g, "l").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");

  // The id includes the mod's name, so two mods that both have a "Boom Stick" don't share one tool in the game.
  function toolId(name, used, modName) {
    const mod = plainId(modName).slice(0, 16);
    let base = "tmm" + (mod ? mod + "_" : "") + (plainId(name).slice(0, 20) || "tool");
    let id = base;
    for (let n = 2; used.has(id); n++) id = base + n;
    used.add(id);
    return id;
  }

  const indent = (code) => (code ? L.prefixLines(code, L.INDENT) : "");

  // Turns the whole workspace into one main.lua file.
  window.buildLua = function (workspace, modName = "") {
    L.init(workspace);
    needs = new Set();
    loopingBlocks = findLoopingBlocks(workspace);
    const init = [];
    const start = [];
    const tick = [];
    const frameBodies = [];
    const state = [];
    const toolIds = new Set();
    let everyCount = 0;
    let unused = 0;

    for (const block of workspace.getTopBlocks(true)) {
      if (!block.isEnabled()) continue;
      if (block.type.startsWith("procedures_def")) {
        // "My blocks": the Lua generator stores the function definition with the helpers.
        L.blockToCode(block);
        continue;
      }
      if (!EVENT_TYPES.has(block.type)) {
        // A loose block outside any event block never runs.
        unused++;
        continue;
      }
      const body = L.statementToCode(block, "DO");
      switch (block.type) {
        case "td_when_start":
          start.push(body);
          break;
        case "td_every_frame":
          // All "every frame" blocks share one loop, placed where the first of them is.
          if (!frameBodies.length) tick.push(null);
          frameBodies.push(body);
          break;
        case "td_when_key":
          tick.push(`  if InputPressed(${luaString(block.getFieldValue("KEY"))}) then\n${indent(body)}  end\n`);
          break;
        case "td_every_seconds": {
          const seconds = Math.max(0.1, Number(block.getFieldValue("SECONDS")) || 1);
          // td_every[n] is the next time this runs. If the game was paused or stuck, it skips the missed turns.
          const timer = `td_every[${++everyCount}]`;
          state.push(`${timer} = ${seconds}`);
          tick.push(
            `  if GetTime() >= ${timer} then\n` +
            `    ${timer} = ${timer} + ${seconds}\n` +
            `    if ${timer} <= GetTime() then ${timer} = GetTime() + ${seconds} end\n` +
            `${indent(body)}  end\n`
          );
          break;
        }
        case "td_tool": {
          const name = block.getFieldValue("NAME").trim() || B.tool_no_name;
          const id = toolId(name, toolIds, modName);
          init.push(`  RegisterTool("${id}", ${luaString(name)}, "MOD/vox/tool.vox")\n  SetBool("game.tool.${id}.enabled", true)\n`);
          tick.push(
            `  if GetString("game.player.tool") == "${id}" and GetBool("game.player.canusetool") and InputPressed("usetool") then\n` +
            `${indent(body)}  end\n`
          );
          break;
        }
      }
    }

    // "Every frame" runs 60 times a second on any computer (twice in one frame at 30 fps, and skips
    // some frames at 144 fps), so speeds and counters in it work the same for everyone.
    const frameBody = frameBodies.join("");
    const frameIndex = tick.indexOf(null);
    if (frameIndex >= 0) {
      tick[frameIndex] = frameBody
        ? "  td_frame = math.min(td_frame + dt, 0.1)\n" +
          "  while td_frame > 0.0166 do\n" +
          "    td_frame = td_frame - 1 / 60\n" +
          (needs.has("aim") ? "    td_aim = nil\n" : "") +
          `${indent(frameBody)}  end\n`
        : "";
      if (frameBody) state.push("td_frame = 0");
    }

    // Things that have to happen every frame for some blocks to work.
    const everyFrame = [];
    if (needs.has("aim")) everyFrame.push("  td_aim = nil\n");
    if (start.some(Boolean)) {
      // "When the game starts" runs in the first frame, when the player is already in the level.
      state.push("td_started = false");
      everyFrame.push(`  if not td_started then\n    td_started = true\n${indent(start.join(""))}  end\n`);
    }
    if (needs.has("timers")) {
      state.push("td_timers = {}");
      everyFrame.push(
        // Timers that are due run in the order they were started.
        "  do\n" +
        "    local due = {}\n" +
        "    for i = #td_timers, 1, -1 do\n" +
        "      if GetTime() >= td_timers[i].time then table.insert(due, 1, table.remove(td_timers, i)) end\n" +
        "    end\n" +
        "    for _, timer in ipairs(due) do timer.action() end\n" +
        "  end\n"
      );
    }
    // Slow motion and lights come after the events, so changes made this frame count straight away.
    const afterEvents = [];
    if (needs.has("slowmo")) {
      state.push("td_slowmo = 0");
      afterEvents.push("  if GetTime() < td_slowmo then SetTimeScale(0.25) end\n");
    }
    if (needs.has("lights")) {
      state.push("td_lights = {}");
      afterEvents.push(
        "  for _, light in ipairs(td_lights) do\n" +
        "    PointLight(light.pos, light.r, light.g, light.b, 3)\n" +
        "  end\n"
      );
    }
    // Every variable starts at 0, so maths with it works before it's been set.
    for (const variable of Blockly.Variables.allUsedVarModels(workspace)) {
      state.push(`${L.getVariableName(variable.getId())} = 0`);
    }
    if (needs.has("sounds")) state.push("td_sounds = {}");
    if (needs.has("calls")) state.push("td_depth = 0");
    if (needs.has("screen")) state.push("td_screen = {}");
    if (needs.has("messages")) state.push("td_messages = {}");
    const showsText = needs.has("screen") || needs.has("messages");
    if (showsText && toolIds.size) state.push(`td_tools = { ${[...toolIds].map((id) => `["${id}"] = true`).join(", ")} }`);
    if (everyCount) state.unshift("td_every = {}");

    const helpers = L.finish("").trim();
    const parts = ["-- Made with Teardown Mod Maker"];
    if (unused) parts.push(`-- ${B.unused_comment}`);
    if (state.length) parts.push(state.join("\n"));
    if (helpers) parts.push(helpers);
    parts.push(`function init()\n${init.join("")}end`);
    parts.push(`function tick(dt)\n${everyFrame.join("")}${tick.join("")}${afterEvents.join("")}end`);
    if (showsText) {
      // A mod with a tool only shows its words while you hold one of its tools, so many mods at once
      // don't cover the screen. A mod without a tool fades its words out 4 seconds after they last changed.
      const draw = ["function draw()\n"];
      if (toolIds.size) {
        draw.push('  if GetPlayerVehicle() ~= 0 or not td_tools[GetString("game.player.tool")] then return end\n');
      }
      draw.push("  local now = GetTime()\n");
      if (needs.has("screen")) {
        draw.push(
          "  local rows = { top = 0.15, middle = 0.5, bottom = 0.85 }\n" +
          "  for spot, line in pairs(td_screen) do\n" +
          (toolIds.size ? "    local fade = 1\n" : "    local fade = math.min(1, 5 - (now - line.time))\n") +
          "    if fade > 0 then\n" +
          "      UiPush()\n" +
          "      UiTranslate(UiCenter(), UiHeight() * (rows[spot] or 0.5))\n" +
          '      UiAlign("center middle")\n' +
          '      UiFont("bold.ttf", 48)\n' +
          "      UiTextOutline(0, 0, 0, fade, 0.1)\n" +
          "      UiColor(1, 1, 1, fade)\n" +
          "      UiText(line.text)\n" +
          "      UiPop()\n" +
          "    end\n" +
          "  end\n"
        );
      }
      if (needs.has("messages")) {
        // Messages sit low on the left, newest at the bottom, and each one fades after 4 seconds.
        draw.push(
          "  UiPush()\n" +
          "  UiTranslate(40, UiHeight() - 160)\n" +
          '  UiAlign("left bottom")\n' +
          '  UiFont("bold.ttf", 24)\n' +
          "  for i = #td_messages, 1, -1 do\n" +
          "    local fade = math.min(1, 5 - (now - td_messages[i].time))\n" +
          "    if fade > 0 then\n" +
          "      UiTextOutline(0, 0, 0, fade, 0.1)\n" +
          "      UiColor(1, 1, 1, fade)\n" +
          "      UiText(td_messages[i].text)\n" +
          "      UiTranslate(0, -30)\n" +
          "    end\n" +
          "  end\n" +
          "  UiPop()\n"
        );
      }
      draw.push("end");
      parts.push(draw.join(""));
    }
    return parts.join("\n\n") + "\n";
  };

  // Two tools with the same name look the same in the game's tool bar, so warn on both blocks.
  window.warnSameToolNames = (workspace) => {
    const tools = workspace.getBlocksByType("td_tool", false).filter((b) => b.isEnabled());
    const count = new Map();
    for (const b of tools) {
      const name = b.getFieldValue("NAME").trim().toLowerCase();
      count.set(name, (count.get(name) || 0) + 1);
    }
    for (const b of workspace.getBlocksByType("td_tool", false)) {
      const same = b.isEnabled() && count.get(b.getFieldValue("NAME").trim().toLowerCase()) > 1;
      b.setWarningText(same ? B.tool_same_name : null);
    }
  };

  window.hasEventBlocks = (workspace) =>
    workspace.getTopBlocks(false).some((b) => EVENT_TYPES.has(b.type) && b.isEnabled());

  const shadowPlace = { shadow: { type: "td_look_point" } };
  const num = (n) => ({ shadow: { type: "math_number", fields: { NUM: n } } });
  const shadowText = (text) => ({ shadow: { type: "text", fields: { TEXT: text } } });
  const block = (type, inputs) => (inputs ? { kind: "block", type, inputs } : { kind: "block", type });
  const category = (id, colour, contents) => ({ kind: "category", name: C[id], colour, toolboxitemid: id, contents });

  window.TOOLBOX = {
    kind: "categoryToolbox",
    contents: [
      category("events", COLOURS.events, [
        block("td_tool"),
        block("td_when_key"),
        block("td_when_start"),
        block("td_every_seconds"),
        block("td_every_frame"),
      ]),
      category("actions", COLOURS.actions, [
        block("td_explode", { WHERE: shadowPlace, SIZE: num(2) }),
        block("td_hole", { WHERE: shadowPlace, SIZE: num(1) }),
        block("td_fire", { WHERE: shadowPlace }),
        block("td_shoot"),
        block("td_paint", { WHERE: shadowPlace, SIZE: num(1) }),
        block("td_shake"),
        block("td_sound"),
        block("td_message", { TEXT: shadowText(B.message_default) }),
      ]),
      category("player", COLOURS.player, [
        block("td_launch", { POWER: num(10) }),
        block("td_push_me", { POWER: num(10) }),
        block("td_teleport", { WHERE: shadowPlace }),
        block("td_set_health", { VALUE: num(100) }),
        block("td_change_health", { VALUE: num(-10) }),
        block("td_slowmo", { SECONDS: num(3) }),
        block("td_regen"),
        block("td_health"),
        block("td_speed"),
        block("td_key_held"),
        block("td_on_ground"),
      ]),
      category("places", COLOURS.places, [
        block("td_look_point"),
        block("td_my_pos"),
        block("td_in_front", { DIST: num(3) }),
        block("td_above", { DIST: num(2), WHERE: shadowPlace }),
        block("td_random_near", { DIST: num(5), WHERE: shadowPlace }),
      ]),
      { kind: "sep" },
      {
        kind: "category", name: C.logic, categorystyle: "logic_category", toolboxitemid: "logic",
        contents: [block("controls_if"), block("logic_compare"), block("logic_operation"), block("logic_negate"), block("logic_boolean")],
      },
      {
        kind: "category", name: C.loops, categorystyle: "loop_category", toolboxitemid: "loops",
        contents: [block("controls_repeat_ext", { TIMES: num(3) })],
      },
      {
        kind: "category", name: C.math, categorystyle: "math_category", toolboxitemid: "math",
        contents: [
          block("math_number"),
          block("math_arithmetic", { A: num(1), B: num(1) }),
          block("math_random_int", { FROM: num(1), TO: num(10) }),
        ],
      },
      {
        kind: "category", name: C.text, categorystyle: "text_category", toolboxitemid: "text",
        contents: [block("text"), block("text_join")],
      },
      { kind: "category", name: C.variables, categorystyle: "variable_category", custom: "VARIABLE", toolboxitemid: "variables" },
      { kind: "sep" },
      {
        kind: "category", name: C.advanced, colour: "#6b5c48", toolboxitemid: "advanced",
        contents: [
          category("timers", COLOURS.timers, [
            block("td_after", { SECONDS: num(2) }),
            block("td_every_seconds"),
            block("td_time"),
          ]),
          category("screen", COLOURS.screen, [
            block("td_screen_text", { TEXT: shadowText(B.screen_text_default) }),
            block("td_clear_screen"),
            block("td_filter"),
          ]),
          category("objects", COLOURS.objects, [
            block("td_push_thing", { POWER: num(10) }),
            block("td_delete_thing"),
            block("td_spawn_box", { SIZE: num(1), WHERE: shadowPlace }),
            block("td_looking_at_thing"),
            block("td_gravity"),
          ]),
          category("effects", COLOURS.effects, [
            block("td_light", { WHERE: shadowPlace }),
            block("td_lights_off"),
            block("td_particles", { WHERE: shadowPlace }),
            block("td_rain"),
          ]),
          { kind: "category", name: C.my_blocks, categorystyle: "procedure_category", custom: "PROCEDURE", toolboxitemid: "my_blocks" },
        ],
      },
    ],
  };

  // Which help entry ("term") explains each block, for the hold-T help.
  window.BLOCK_TERMS = {
    td_when_start: "when_start", td_every_frame: "every_frame", td_when_key: "when_key", td_tool: "tool",
    td_every_seconds: "every_seconds",
    td_explode: "explode", td_hole: "hole", td_fire: "fire", td_shoot: "shoot", td_message: "message",
    td_paint: "paint", td_shake: "shake", td_sound: "sound",
    td_set_health: "set_health", td_change_health: "change_health", td_health: "health", td_launch: "launch",
    td_push_me: "push_me", td_teleport: "teleport", td_slowmo: "slowmo", td_regen: "regen", td_speed: "speed",
    td_key_held: "key_held", td_on_ground: "on_ground",
    td_look_point: "look_point", td_my_pos: "my_pos", td_in_front: "in_front", td_above: "above",
    td_random_near: "random_near",
    td_after: "after", td_time: "time",
    td_screen_text: "screen_text", td_clear_screen: "clear_screen", td_filter: "filter",
    td_push_thing: "push_thing", td_delete_thing: "delete_thing", td_spawn_box: "spawn_box",
    td_looking_at_thing: "looking_at_thing", td_gravity: "gravity",
    td_light: "light", td_lights_off: "lights_off", td_particles: "particles", td_rain: "rain",
    controls_if: "if", logic_compare: "compare", logic_operation: "and_or", logic_negate: "not",
    logic_boolean: "true_false", controls_repeat_ext: "repeat", math_number: "number",
    math_arithmetic: "arithmetic", math_random_int: "random", text: "text", text_join: "join",
    variables_set: "variable_set", variables_get: "variable_get", math_change: "variable_change",
    procedures_defnoreturn: "function_def", procedures_defreturn: "function_def",
    procedures_callnoreturn: "function_call", procedures_callreturn: "function_call",
    procedures_ifreturn: "function_return",
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
