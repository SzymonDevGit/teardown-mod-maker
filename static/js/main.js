// Sets up the editor and the buttons along the top.
(function () {
  const T = window.APP.t.app;
  const STORAGE_KEY = "tmm.project";
  const $ = (id) => document.getElementById(id);

  const BLOCK_FONT = "'Barlow Condensed', 'Arial Narrow', sans-serif";
  const BLOCK_FONT_SAMPLE = "600 16px 'Barlow Condensed'";
  const fontReady = !document.fonts || document.fonts.check(BLOCK_FONT_SAMPLE);
  const START_SCALE = 1.1;

  // Keeps the blocks in the side panel the same size when you zoom the workspace in or out.
  // On a phone it is made smaller, so the blocks fit next to the block list.
  class FixedSizeFlyout extends Blockly.VerticalFlyout {
    getFlyoutScale() {
      const toolbox = this.targetWorkspace.getToolbox();
      const room = window.innerWidth - (toolbox ? toolbox.getWidth() : 0) - 30;
      return Math.max(0.55, Math.min(START_SCALE, room / 480));
    }
  }

  const workspace = Blockly.inject("workspace", {
    toolbox: window.TOOLBOX,
    plugins: { flyoutsVerticalToolbox: FixedSizeFlyout },
    media: window.APP.blocklyMedia,
    trashcan: true,
    zoom: { controls: true, wheel: true, startScale: START_SCALE },
    move: { scrollbars: true, drag: true, wheel: false },
    grid: { spacing: 24, length: 24, colour: "#262019", snap: true },
    theme: Blockly.Theme.defineTheme("tmm-scrapyard", {
      base: Blockly.Themes.Classic,
      blockStyles: {
        logic_blocks: { colourPrimary: "#5b6470" },
        loop_blocks: { colourPrimary: "#4c7a3a" },
        math_blocks: { colourPrimary: "#4b4f8a" },
        text_blocks: { colourPrimary: "#2d7f7a" },
        variable_blocks: { colourPrimary: "#8a3e6e" },
        procedure_blocks: { colourPrimary: "#7a4a8a" },
      },
      categoryStyles: {
        logic_category: { colour: "#5b6470" },
        loop_category: { colour: "#4c7a3a" },
        math_category: { colour: "#4b4f8a" },
        text_category: { colour: "#2d7f7a" },
        variable_category: { colour: "#8a3e6e" },
        procedure_category: { colour: "#7a4a8a" },
      },
      componentStyles: {
        workspaceBackgroundColour: "#16130f",
        toolboxBackgroundColour: "#0f0d0b",
        toolboxForegroundColour: "#eeeeee",
        flyoutBackgroundColour: "#1f1a14",
        flyoutForegroundColour: "#ddd5c8",
        flyoutOpacity: 1,
        scrollbarColour: "#6b5c48",
        scrollbarOpacity: 0.6,
        insertionMarkerColour: "#f5b400",
        insertionMarkerOpacity: 0.4,
        cursorColour: "#f5b400",
      },
      fontStyle: { family: BLOCK_FONT, weight: "600", size: 13 },
    }),
    renderer: "zelos",
  });
  window.workspace = workspace;

  // Blockly sizes blocks from the font it has when they are drawn. If the web font
  // arrives later, reload the blocks so their text fits.
  if (!fontReady) {
    document.fonts.load(BLOCK_FONT_SAMPLE).then(() => {
      if (!document.fonts.check(BLOCK_FONT_SAMPLE)) return;
      const state = Blockly.serialization.workspaces.save(workspace);
      Blockly.Events.disable();
      try {
        Blockly.serialization.workspaces.load(state, workspace);
      } finally {
        Blockly.Events.enable();
      }
      window.warnSameToolNames(workspace);
      window.warnLuaCode(workspace);
    }).catch(() => {});
  }
  if (document.fonts) document.fonts.ready.then(() => Blockly.svgResize(workspace)).catch(() => {});

  // ---- Saving: blocks and mod details live in the browser, and in files ----

  function readStorage() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  }

  function writeStorage(project) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      return true;
    } catch {
      // Private windows can block storage; the editor still works without it.
      return false;
    }
  }

  function modInfo() {
    return {
      name: $("mod-name").value.trim(),
      author: $("mod-author").value.trim(),
      description: $("mod-description").value.trim(),
    };
  }

  function currentProject() {
    return {
      format: "teardown-mod-maker",
      version: 1,
      info: modInfo(),
      blocks: Blockly.serialization.workspaces.save(workspace),
    };
  }

  // Blocks this editor doesn't know (from a newer or older version) are left out, so the rest still opens.
  function withoutUnknownBlocks(state) {
    let dropped = 0;
    const clean = (block) => {
      while (block && !Blockly.Blocks[block.type]) {
        dropped++;
        block = block.next && block.next.block;
      }
      if (!block || typeof block !== "object") return null;
      for (const [name, input] of Object.entries(block.inputs || {})) {
        if (input.shadow && !Blockly.Blocks[input.shadow.type]) delete input.shadow;
        if (input.block) input.block = clean(input.block);
        if (!input.block) delete input.block;
        if (!input.block && !input.shadow) delete block.inputs[name];
      }
      if (block.next) {
        block.next.block = clean(block.next.block);
        if (!block.next.block) delete block.next;
      }
      return block;
    };
    const copy = JSON.parse(JSON.stringify(state));
    if (copy.blocks && Array.isArray(copy.blocks.blocks)) copy.blocks.blocks = copy.blocks.blocks.map(clean).filter(Boolean);
    return { state: copy, dropped };
  }

  // Returns how many unknown blocks were left out. If the file still can't be read, the old blocks stay.
  function loadProject(project) {
    if (!project || project.format !== "teardown-mod-maker" || !project.blocks) {
      throw new Error("not a project");
    }
    const { state, dropped } = withoutUnknownBlocks(project.blocks);
    const before = Blockly.serialization.workspaces.save(workspace);
    try {
      workspace.clear();
      Blockly.serialization.workspaces.load(state, workspace);
    } catch (error) {
      // Blockly stops part way through and leaves resizing off, so turn it back on and put the old blocks back.
      workspace.setResizesEnabled(true);
      Blockly.Events.setGroup(false);
      workspace.clear();
      Blockly.serialization.workspaces.load(before, workspace);
      throw error;
    }
    $("mod-vox").value = "";
    $("mod-shoot-vox").value = "";
    const info = project.info || {};
    $("mod-name").value = info.name || T.mod_name_default;
    $("mod-author").value = info.author || "";
    $("mod-description").value = info.description || "";
    workspace.clearUndo();
    return dropped;
  }

  function startFresh() {
    workspace.clear();
    Blockly.serialization.workspaces.load(window.STARTER, workspace);
    $("mod-vox").value = "";
    $("mod-shoot-vox").value = "";
    $("mod-name").value = T.mod_name_default;
    $("mod-author").value = "";
    $("mod-description").value = "";
    workspace.clearUndo();
  }

  const saved = readStorage();
  try {
    const dropped = loadProject(saved);
    if (dropped) setTimeout(() => alert(T.blocks_skipped.replace("%1", dropped)));
  } catch {
    // Keep a copy of a saved mod the editor couldn't open, instead of writing over it.
    if (saved) {
      try {
        localStorage.setItem(STORAGE_KEY + ".broken", JSON.stringify(saved));
      } catch {
        // Nothing more to do without storage.
      }
    }
    startFresh();
  }

  // ---- Code panel ----

  const codePanel = $("code-panel");
  const codeButton = $("btn-code");

  function refreshCode() {
    try {
      $("code-output").textContent = window.buildLua(workspace, modInfo().name);
    } catch (error) {
      console.error(error);
      $("code-output").textContent = T.errors.code_failed;
    }
  }

  // Tool ids include the mod's name, so the code changes with it.
  $("mod-name").addEventListener("input", () => {
    if (!codePanel.hidden) refreshCode();
  });

  // Blocks that aren't inside an event block never run, so they're greyed out.
  workspace.addChangeListener(Blockly.Events.disableOrphans);

  let saveTimer = null;
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      writeStorage(currentProject());
      if (!codePanel.hidden) refreshCode();
    }, 300);
  }
  workspace.addChangeListener((event) => {
    if (event.isUiEvent) return;
    window.warnSameToolNames(workspace);
    window.warnLuaCode(workspace);
    saveSoon();
  });
  for (const id of ["mod-name", "mod-author", "mod-description"]) $(id).addEventListener("input", saveSoon);

  codeButton.addEventListener("click", () => {
    codePanel.hidden = !codePanel.hidden;
    codeButton.textContent = codePanel.hidden ? T.show_code : T.hide_code;
    if (!codePanel.hidden) refreshCode();
    Blockly.svgResize(workspace);
  });

  // ---- New / Open / Save ----

  $("btn-new").addEventListener("click", () => {
    if (confirm(T.confirm_new)) {
      startFresh();
      writeStorage(currentProject());
    }
  });

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const fileSlug = () => window.Modpack.slugify($("mod-name").value || T.mod_name_default);

  $("btn-save").addEventListener("click", () => {
    const json = JSON.stringify(currentProject(), null, 2);
    downloadBlob(new Blob([json], { type: "application/json" }), `${fileSlug()}.tmm.json`);
  });

  $("btn-open").addEventListener("click", () => $("open-file").click());
  $("open-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    if (!confirm(T.confirm_open)) return;
    try {
      const dropped = loadProject(JSON.parse(await file.text()));
      writeStorage(currentProject());
      if (dropped) alert(T.blocks_skipped.replace("%1", dropped));
    } catch {
      alert(T.open_failed);
    }
  });

  // ---- Examples: ready-made mods to open and change ----

  const examplesDialog = $("examples-dialog");
  for (const example of window.EXAMPLES || []) {
    const words = window.APP.t.examples[example.id];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "example";
    const name = document.createElement("strong");
    name.textContent = words.name;
    const stars = document.createElement("span");
    stars.className = "stars";
    stars.setAttribute("aria-label", `${example.stars}/5`);
    stars.innerHTML = "★".repeat(example.stars) + `<span class="off">${"★".repeat(5 - example.stars)}</span>`;
    const desc = document.createElement("small");
    desc.textContent = words.desc;
    button.append(name, stars, desc);
    button.addEventListener("click", () => {
      if (!confirm(T.examples_confirm)) return;
      // The example has no author, so keep the name the player already typed.
      const author = $("mod-author").value;
      loadProject(example.project());
      $("mod-author").value = author;
      window.arrangeExample(workspace);
      workspace.clearUndo();
      writeStorage(currentProject());
      examplesDialog.close();
      // Start at the top left, where the example's first block is.
      workspace.scroll(0, 0);
    });
    $("examples-list").append(button);
  }
  $("btn-examples").addEventListener("click", () => examplesDialog.showModal());

  // ---- Language ----

  document.querySelectorAll("#lang-switch [data-lang]").forEach((button) => {
    button.addEventListener("click", () => {
      const lang = button.dataset.lang;
      if (lang === window.APP.lang) return;
      if (!writeStorage(currentProject()) && !confirm(T.confirm_lang_lose)) return;
      try {
        localStorage.setItem("tmm.lang", lang);
      } catch {
        // Without storage the language just isn't remembered next time.
      }
      window.location.href = window.APP.pages[lang];
    });
  });

  // ---- Download mod ----

  const dialog = $("download-dialog");
  const errorBox = $("download-error");

  function showError(code) {
    errorBox.textContent = T.errors[code] || T.errors.zip_failed;
    errorBox.hidden = false;
  }

  $("btn-download").addEventListener("click", () => {
    errorBox.hidden = true;
    dialog.showModal();
  });
  $("download-cancel").addEventListener("click", () => dialog.close());

  const models = new Map();

  async function loadModel(url) {
    if (!models.has(url)) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`model ${url}: ${response.status}`);
      models.set(url, new Uint8Array(await response.arrayBuffer()));
    }
    return models.get(url);
  }

  const loadDefaultVox = () => loadModel(window.APP.defaultVox);

  // The models for the mod's "shoot a ..." blocks. Returns null when "my own model" has no file picked.
  async function shootModels() {
    const files = [];
    for (const thing of window.shootThings(workspace)) {
      if (thing === "my_model") {
        const file = $("mod-shoot-vox").files[0];
        if (!file) return null;
        files.push({ path: "vox/my_model.vox", data: new Uint8Array(await file.arrayBuffer()) });
      } else {
        files.push({ path: `vox/${thing}.vox`, data: await loadModel(`${window.APP.shootVox}${thing}.vox`) });
      }
    }
    return files;
  }

  $("download-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.hidden = true;
    if (!window.hasEventBlocks(workspace)) {
      showError("empty_mod");
      return;
    }
    const voxFile = $("mod-vox").files[0];
    let lua;
    try {
      lua = window.buildLua(workspace, modInfo().name);
    } catch (error) {
      console.error(error);
      showError("code_failed");
      return;
    }
    const hasTool = workspace.getTopBlocks(false).some((b) => ["td_tool", "td_tool_auto"].includes(b.type) && b.isEnabled());
    try {
      const vox = voxFile ? new Uint8Array(await voxFile.arrayBuffer()) : null;
      const extraFiles = await shootModels();
      if (!extraFiles) {
        showError("no_shoot_vox");
        return;
      }
      const { bytes } = window.Modpack.buildModZip({
        ...modInfo(),
        lua,
        vox,
        hasTool,
        defaultVox: hasTool && !vox ? await loadDefaultVox() : null,
        extraFiles,
      });
      downloadBlob(new Blob([bytes], { type: "application/zip" }), `${fileSlug()}.zip`);
      writeStorage(currentProject());
      dialog.close();
    } catch (error) {
      if (error instanceof window.Modpack.ModError) {
        showError(error.message);
      } else {
        console.error(error);
        showError("zip_failed");
      }
    }
  });

  // ---- Lua code blocks: a big text box to type the code in ----

  const luaDialog = $("lua-dialog");
  const luaCode = $("lua-code");
  let luaDone = null;
  window.editLuaCode = (code, done) => {
    luaCode.value = code;
    luaDone = done;
    luaDialog.showModal();
    luaCode.focus();
  };
  // Tab puts in two spaces instead of leaving the box.
  luaCode.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || event.shiftKey) return;
    event.preventDefault();
    luaCode.setRangeText("  ", luaCode.selectionStart, luaCode.selectionEnd, "end");
  });
  $("lua-cancel").addEventListener("click", () => luaDialog.close());
  luaDialog.addEventListener("close", () => {
    if (luaDialog.returnValue === "done" && luaDone) luaDone(luaCode.value);
    luaDialog.returnValue = "";
    luaDone = null;
  });

  // ---- Tutorial video: opens by itself on the first visit only ----

  const tutorial = $("tutorial-dialog");
  if (tutorial) {
    const video = $("tutorial-video");
    const TUTORIAL_KEY = "tmm.tutorialSeen";
    const openTutorial = () => {
      video.src = video.dataset.src;
      tutorial.showModal();
    };
    // Clearing the src stops the video when the popup closes.
    tutorial.addEventListener("close", () => video.removeAttribute("src"));
    $("btn-tutorial").addEventListener("click", openTutorial);

    let seen = false;
    try {
      seen = localStorage.getItem(TUTORIAL_KEY) === "1";
      localStorage.setItem(TUTORIAL_KEY, "1");
    } catch {
      // Without storage the popup can't remember it was shown, so it isn't forced on every visit.
      seen = true;
    }
    if (!seen) openTutorial();
  }

  window.addEventListener("resize", () => Blockly.svgResize(workspace));
})();
