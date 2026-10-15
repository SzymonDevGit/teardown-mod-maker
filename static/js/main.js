// Sets up the editor and the buttons along the top.
(function () {
  const T = window.APP.t.app;
  const STORAGE_KEY = "tmm.project";
  const $ = (id) => document.getElementById(id);

  const workspace = Blockly.inject("workspace", {
    toolbox: window.TOOLBOX,
    media: window.APP.blocklyMedia,
    trashcan: true,
    zoom: { controls: true, wheel: true, startScale: 1.1 },
    move: { scrollbars: true, drag: true, wheel: false },
    grid: { spacing: 24, length: 2, colour: "#2c303a", snap: true },
    theme: Blockly.Theme.defineTheme("tmm-dark", {
      base: Blockly.Themes.Classic,
      componentStyles: {
        workspaceBackgroundColour: "#1b1e24",
        toolboxBackgroundColour: "#20232b",
        toolboxForegroundColour: "#f2f3f5",
        flyoutBackgroundColour: "#2a2e38",
        flyoutForegroundColour: "#d0d4dc",
        flyoutOpacity: 1,
        scrollbarColour: "#797979",
        scrollbarOpacity: 0.5,
        insertionMarkerColour: "#ffffff",
        insertionMarkerOpacity: 0.3,
        cursorColour: "#d0d0d0",
      },
      fontStyle: { family: "Nunito, system-ui, sans-serif", weight: "700", size: 12 },
    }),
    renderer: "zelos",
  });
  window.workspace = workspace;

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
    } catch {
      // Private windows can block storage; the editor still works without it.
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

  function loadProject(project) {
    if (!project || project.format !== "teardown-mod-maker" || !project.blocks) {
      throw new Error("not a project");
    }
    workspace.clear();
    Blockly.serialization.workspaces.load(project.blocks, workspace);
    const info = project.info || {};
    $("mod-name").value = info.name || T.mod_name_default;
    $("mod-author").value = info.author || "";
    $("mod-description").value = info.description || "";
  }

  function startFresh() {
    workspace.clear();
    Blockly.serialization.workspaces.load(window.STARTER, workspace);
    $("mod-name").value = T.mod_name_default;
    $("mod-author").value = "";
    $("mod-description").value = "";
  }

  try {
    loadProject(readStorage());
  } catch {
    startFresh();
  }

  // ---- Code panel ----

  const codePanel = $("code-panel");
  const codeButton = $("btn-code");

  function refreshCode() {
    $("code-output").textContent = window.buildLua(workspace);
  }

  let saveTimer = null;
  workspace.addChangeListener((event) => {
    if (event.isUiEvent) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      writeStorage(currentProject());
      if (!codePanel.hidden) refreshCode();
    }, 300);
  });

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

  function fileSlug() {
    const name = $("mod-name").value || T.mod_name_default;
    return name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "my_mod";
  }

  $("btn-save").addEventListener("click", () => {
    const json = JSON.stringify(currentProject(), null, 2);
    downloadBlob(new Blob([json], { type: "application/json" }), `${fileSlug()}.tmm.json`);
  });

  $("btn-open").addEventListener("click", () => $("open-file").click());
  $("open-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      loadProject(JSON.parse(await file.text()));
      writeStorage(currentProject());
    } catch {
      alert(T.open_failed);
    }
  });

  // ---- Language ----

  $("lang-select").addEventListener("change", (event) => {
    writeStorage(currentProject());
    window.location.href = `/lang/${event.target.value}`;
  });

  // ---- Download mod ----

  const dialog = $("download-dialog");
  const errorBox = $("download-error");

  function showError(code) {
    errorBox.textContent = T.errors[code] || T.errors.network;
    errorBox.hidden = false;
  }

  $("btn-download").addEventListener("click", () => {
    errorBox.hidden = true;
    dialog.showModal();
  });
  $("download-cancel").addEventListener("click", () => dialog.close());

  function readFileBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  $("download-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.hidden = true;
    if (!window.hasEventBlocks(workspace)) {
      showError("empty_mod");
      return;
    }
    const voxFile = $("mod-vox").files[0];
    const body = { ...modInfo(), lua: window.buildLua(workspace) };
    try {
      if (voxFile) body.vox = await readFileBase64(voxFile);
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        showError(data.error);
        return;
      }
      downloadBlob(await response.blob(), `${fileSlug()}.zip`);
      writeStorage(currentProject());
      dialog.close();
    } catch {
      showError("network");
    }
  });

  window.addEventListener("resize", () => Blockly.svgResize(workspace));
})();
