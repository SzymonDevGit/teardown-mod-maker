// Five example mods, from a simple gun to a small game, that players can open, try and change.
// Their words come from the "examples" part of the translations, so each one opens in the page's language.
(function () {
  const X = window.APP.t.examples;

  // ---- Small helpers that write blocks in Blockly's save format ----
  const num = (n) => ({ shadow: { type: "math_number", fields: { NUM: n } } });
  const str = (text) => ({ block: { type: "text", fields: { TEXT: text } } });
  const look = { shadow: { type: "td_look_point" } };
  const me = { block: { type: "td_my_pos" } };
  const get = (name) => ({ block: { type: "variables_get", fields: { VAR: { name } } } });
  const set = (name, value) => ({ type: "variables_set", fields: { VAR: { name } }, inputs: { VALUE: value } });
  const change = (name, by) => ({ type: "math_change", fields: { VAR: { name } }, inputs: { DELTA: num(by) } });
  const compare = (a, op, b) => ({ block: { type: "logic_compare", fields: { OP: op }, inputs: { A: a, B: b } } });
  const join = (...parts) => ({
    block: {
      type: "text_join",
      extraState: { itemCount: parts.length },
      inputs: Object.fromEntries(parts.map((part, i) => ["ADD" + i, part])),
    },
  });
  const call = (name) => ({ type: "procedures_callnoreturn", extraState: { name } });
  const block = (type, fields, inputs) => ({ type, ...(fields && { fields }), ...(inputs && { inputs }) });

  // Blocks one under the other, ready to go in a "DO" slot.
  function stack(...blocks) {
    for (let i = blocks.length - 2; i >= 0; i--) blocks[i].next = { block: blocks[i + 1] };
    return { block: blocks[0] };
  }

  // "if ... then ... else if ... else ...": pass [condition, stack] pairs, then the else stack (if any).
  function when(branches, otherwise) {
    const inputs = {};
    branches.forEach(([condition, body], i) => {
      inputs["IF" + i] = condition;
      inputs["DO" + i] = body;
    });
    if (otherwise) inputs.ELSE = otherwise;
    const extra = {};
    if (branches.length > 1) extra.elseIfCount = branches.length - 1;
    if (otherwise) extra.hasElse = true;
    return { type: "controls_if", ...(Object.keys(extra).length && { extraState: extra }), inputs };
  }

  const event = (type, fields, body) => ({ type, ...(fields && { fields }), inputs: { DO: body } });
  const myBlock = (name, body) => ({ type: "procedures_defnoreturn", fields: { NAME: name }, inputs: { STACK: body } });

  function project(id, blocks) {
    return {
      format: "teardown-mod-maker",
      version: 1,
      info: { name: X[id].name, description: X[id].mod_desc },
      blocks: { blocks: { languageVersion: 0, blocks } },
    };
  }

  // ---- 1. Pop Gun: a tool and three action blocks ----
  function popGun() {
    const t = X.pop_gun;
    return project("pop_gun", [
      event("td_tool", { NAME: t.tool }, stack(
        block("td_shoot", { KIND: "bullet" }),
        block("td_sound", { SOUND: "tools/gun0.ogg" }),
        block("td_shake", { STRENGTH: "0.3" }),
      )),
    ]);
  }

  // ---- 2. Rocket Launcher: a variable for ammo, if / else, and a timer to reload ----
  function rocketLauncher() {
    const t = X.rocket_launcher;
    const showAmmo = () => block("td_screen_text", { SPOT: "bottom" }, { TEXT: join(str(t.ammo_text), get(t.var_rockets)) });
    return project("rocket_launcher", [
      event("td_when_start", null, stack(set(t.var_rockets, num(4)), showAmmo())),
      event("td_tool", { NAME: t.tool }, stack(
        when([[compare(get(t.var_rockets), "GT", num(0)), stack(
          block("td_shoot", { KIND: "rocket" }),
          block("td_sound", { SOUND: "tools/launcher0.ogg" }),
          block("td_shake", { STRENGTH: "0.6" }),
          change(t.var_rockets, -1),
          showAmmo(),
        )]], stack(
          block("td_sound", { SOUND: "warning-beep.ogg" }),
          block("td_message", null, { TEXT: str(t.empty) }),
        )),
      )),
      event("td_when_key", { KEY: "r" }, stack(
        when([[compare(get(t.var_rockets), "EQ", num(0)), stack(
          block("td_message", null, { TEXT: str(t.reloading) }),
          block("td_after", null, {
            SECONDS: num(2),
            DO: stack(set(t.var_rockets, num(4)), block("td_sound", { SOUND: "metal/hit-s0.ogg" }), showAmmo()),
          }),
        )]]),
      )),
    ]);
  }

  // ---- 3. Crate Cannon: shoot things, switch ammo with a key, blow up the last shot ----
  function crateCannon() {
    const t = X.crate_cannon;
    const ammo = t.var_ammo;
    const show = (text) => stack(block("td_screen_text", { SPOT: "bottom" }, { TEXT: str(text) }));
    return project("crate_cannon", [
      event("td_when_start", null, stack(set(ammo, num(1)), call(t.my_block))),
      event("td_tool", { NAME: t.tool }, stack(
        when([
          [compare(get(ammo), "EQ", num(1)), stack(block("td_shoot_object", { THING: "crate" }, { SPEED: num(40) }))],
          [compare(get(ammo), "EQ", num(2)), stack(block("td_shoot_object", { THING: "barrel" }, { SPEED: num(30) }))],
        ], stack(block("td_shoot_object", { THING: "wrecking_ball" }, { SPEED: num(25) }))),
        block("td_sound", { SOUND: "tools/launcher0.ogg" }),
        block("td_shake", { STRENGTH: "0.3" }),
      )),
      event("td_when_key", { KEY: "q" }, stack(
        change(ammo, 1),
        when([[compare(get(ammo), "GT", num(3)), stack(set(ammo, num(1)))]]),
        call(t.my_block),
        block("td_sound", { SOUND: "warning-beep.ogg" }),
      )),
      event("td_when_key", { KEY: "b" }, stack(
        block("td_explode", null, { WHERE: { block: { type: "td_last_shot" } }, SIZE: num(2) }),
      )),
      myBlock(t.my_block, stack(
        when([
          [compare(get(ammo), "EQ", num(1)), show(t.ammo_crates)],
          [compare(get(ammo), "EQ", num(2)), show(t.ammo_barrels)],
        ], show(t.ammo_balls)),
      )),
    ]);
  }

  // ---- 4. Superhero Kit: a laser that fires while you hold a key, and on/off switches made with variables ----
  function superhero() {
    const t = X.superhero;
    // A key that turns something on, and off again the next time you press it.
    const toggle = (key, variable, on, off) => event("td_when_key", { KEY: key }, stack(
      when([[compare(get(variable), "EQ", num(0)), stack(...on, set(variable, num(1)))]], stack(...off, set(variable, num(0)))),
    ));
    const showKeys = () => block("td_screen_text", { SPOT: "bottom" }, { TEXT: str(t.keys_text) });
    return project("superhero", [
      event("td_when_start", null, stack(
        block("td_power", { POWER: "god", ON: "on" }),
        block("td_power", { POWER: "jump", ON: "on" }),
        showKeys(),
        block("td_message", null, { TEXT: str(t.keys_again) }),
      )),
      {
        // No tool, so the words show whatever you're holding. Each new beam starts before the last one fades.
        type: "td_while_every", fields: { SECONDS: 0.1 },
        inputs: {
          COND: { block: { type: "td_key_held", fields: { KEY: "h" } } },
          DO: stack(block("td_laser", { COLOUR: "red" })),
        },
      },
      toggle("g", t.var_flying,
        [block("td_power", { POWER: "fly", ON: "on" }), block("td_message", null, { TEXT: str(t.fly_on) })],
        [block("td_power", { POWER: "fly", ON: "off" }), block("td_message", null, { TEXT: str(t.fly_off) })]),
      toggle("z", t.var_zoomed,
        [block("td_zoom", null, { ZOOM: num(4) })],
        [block("td_zoom", null, { ZOOM: num(1) })]),
      event("td_when_key", { KEY: "v" }, stack(
        block("td_force", { DIR: "push" }, { DIST: num(10), WHERE: me, POWER: num(20) }),
        block("td_particles", { KIND: "smoke" }, { WHERE: me }),
        block("td_shake", { STRENGTH: "1" }),
      )),
      event("td_when_key", { KEY: "c" }, stack(block("td_freeze", { DO: "freeze" }))),
      event("td_when_key", { KEY: "x" }, stack(block("td_freeze", { DO: "all" }))),
      // Showing the same words again doesn't restart their fade, so clear the screen first.
      event("td_when_key", { KEY: "q" }, stack(block("td_clear_screen"), showKeys())),
    ]);
  }

  // ---- 5. Storm Survival: a small game with a countdown, timers, My blocks and some real Lua ----
  function stormSurvival() {
    const t = X.storm_survival;
    const playing = () => compare(get(t.var_playing), "EQ", num(1));
    return project("storm_survival", [
      event("td_when_start", null, stack(block("td_message", null, { TEXT: str(t.press_n) }))),
      event("td_when_key", { KEY: "n" }, stack(
        when([[compare(get(t.var_playing), "EQ", num(0)), stack(
          set(t.var_playing, num(1)),
          set(t.var_time, num(60)),
          set(t.var_level, num(1)),
          block("td_regen", { ON: "off" }),
          block("td_weather", { WEATHER: "night" }),
          block("td_rain", { ON: "on" }),
          block("td_screen_text", { SPOT: "middle" }, { TEXT: str(t.survive) }),
          block("td_after", null, { SECONDS: num(15), DO: stack(call(t.worse)) }),
          block("td_after", null, { SECONDS: num(30), DO: stack(call(t.worse)) }),
          block("td_after", null, { SECONDS: num(45), DO: stack(call(t.worse)) }),
        )]]),
      )),
      event("td_every_seconds", { SECONDS: 1 }, stack(
        when([[playing(), stack(
          change(t.var_time, -1),
          block("td_screen_text", { SPOT: "top" }, {
            TEXT: join(str(t.time_text), get(t.var_time), str(t.level_text), get(t.var_level)),
          }),
          when([
            [compare({ block: { type: "td_health" } }, "LT", num(1)), stack(
              call(t.end),
              block("td_screen_text", { SPOT: "middle" }, { TEXT: str(t.lost) }),
            )],
            [compare(get(t.var_time), "LT", num(1)), stack(
              call(t.end),
              block("td_screen_text", { SPOT: "middle" }, {
                TEXT: join(str(t.won), { block: { type: "td_lua_value", fields: { CODE: t.lua_value } } }),
              }),
            )],
          ]),
        )]]),
      )),
      {
        type: "td_while_every", fields: { SECONDS: 2 },
        inputs: {
          COND: playing(),
          DO: stack(block("controls_repeat_ext", null, { TIMES: get(t.var_level), DO: stack(call(t.strike)) })),
        },
      },
      myBlock(t.strike, stack(
        block("td_lightning", null, { WHERE: { block: { type: "td_random_near", inputs: { DIST: num(20), WHERE: me } } } }),
      )),
      myBlock(t.worse, stack(
        change(t.var_level, 1),
        block("td_message", null, { TEXT: str(t.worse_text) }),
        block("td_shake", { STRENGTH: "0.6" }),
      )),
      myBlock(t.end, stack(
        set(t.var_playing, num(0)),
        block("td_weather", { WEATHER: "day" }),
        block("td_rain", { ON: "off" }),
        block("td_regen", { ON: "on" }),
        block("td_message", null, { TEXT: str(t.play_again) }),
      )),
      { type: "td_lua_top", fields: { CODE: t.lua_top } },
    ]);
  }

  // Puts the blocks of an example in two tidy columns, in the order they are written above.
  window.arrangeExample = function (workspace) {
    const GAP = 32;
    const blocks = workspace.getTopBlocks(false);
    const sizes = blocks.map((b) => {
      const box = b.getBoundingRectangle();
      return { width: box.right - box.left, height: box.bottom - box.top };
    });
    const columns = [[], []];
    const heights = [0, 0];
    blocks.forEach((b, i) => {
      // Keep the first two blocks in the first column, so the mod reads from the top left.
      const col = i < 2 || heights[0] <= heights[1] ? 0 : 1;
      columns[col].push(i);
      heights[col] += sizes[i].height + GAP;
    });
    const x0 = 40;
    const x1 = x0 + Math.max(0, ...columns[0].map((i) => sizes[i].width)) + GAP * 2;
    columns.forEach((list, col) => {
      let y = 40;
      for (const i of list) {
        blocks[i].moveTo(new Blockly.utils.Coordinate(col ? x1 : x0, y));
        y += sizes[i].height + GAP;
      }
    });
  };

  window.EXAMPLES = [
    { id: "pop_gun", stars: 1, project: popGun },
    { id: "rocket_launcher", stars: 2, project: rocketLauncher },
    { id: "crate_cannon", stars: 3, project: crateCannon },
    { id: "superhero", stars: 4, project: superhero },
    { id: "storm_survival", stars: 5, project: stormSurvival },
  ];
})();
