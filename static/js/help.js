// Hold T to see what everything on screen means, like the T key in Baldur's Gate 3.
(function () {
  const TERMS = window.APP.t.terms;
  const GLOSSARY = ["mod", "lua", "event", "frame", "vox"];
  const MAX_BLOCK_LABELS = 40;

  const layer = document.getElementById("help-layer");
  const glossary = document.getElementById("help-glossary");
  let showing = false;
  const pointer = { x: -1, y: -1 };
  document.addEventListener("pointermove", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });

  function makeLabel(termKey) {
    const term = TERMS[termKey];
    if (!term) return null;
    const label = document.createElement("div");
    label.className = "help-label";
    const name = document.createElement("strong");
    name.textContent = term.name;
    label.append(name, term.desc);
    return label;
  }

  function isVisible(rect) {
    return rect.width > 0 && rect.height > 0 &&
      rect.bottom > 0 && rect.right > 0 &&
      rect.top < window.innerHeight && rect.left < window.innerWidth;
  }

  let placed = [];

  const overlaps = (a, b) =>
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

  // Put the label below (or beside) the thing it explains, moving it down past
  // other labels. If there's no free space left, skip it so the screen stays readable.
  function placeLabel(termKey, rect, beside = false) {
    const label = makeLabel(termKey);
    if (!label) return null;
    layer.appendChild(label);
    const width = label.offsetWidth;
    const height = label.offsetHeight;
    const left = Math.min(Math.max(4, beside ? rect.right + 6 : rect.left), window.innerWidth - width - 4);
    let top = beside ? rect.top : rect.bottom + 4;
    for (let tries = 0; tries < 8; tries++) {
      const box = { left, right: left + width, top, bottom: top + height };
      const hit = placed.find((other) => overlaps(box, other));
      if (!hit) {
        if (box.bottom > window.innerHeight - 4) break;
        label.style.top = `${top}px`;
        label.style.left = `${left}px`;
        placed.push({ ...box, bottom: box.bottom + 4 });
        return label;
      }
      top = hit.bottom;
    }
    label.remove();
    return null;
  }

  // One label per kind of block, for the blocks visible in a workspace.
  // Blocks hidden behind the open block menu (the flyout) are skipped.
  function blockRects(ws, seen, hiddenBy) {
    const results = [];
    for (const block of ws.getAllBlocks(false)) {
      const term = window.BLOCK_TERMS[block.type];
      const svg = block.getSvgRoot && block.getSvgRoot();
      if (!term || !svg || block.isShadow() || seen.has(term)) continue;
      // Measure only the block's own row, not the blocks nested inside it.
      const path = svg.querySelector(":scope > .blocklyPath") || svg;
      const rect = path.getBoundingClientRect();
      if (!isVisible(rect)) continue;
      const box = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.top + Math.min(rect.height, 48) };
      if (hiddenBy && overlaps(box, hiddenBy)) continue;
      seen.add(term);
      results.push([term, box]);
      if (results.length >= MAX_BLOCK_LABELS) break;
    }
    return results;
  }

  function openFlyout(workspace) {
    const flyout = workspace.getFlyout && workspace.getFlyout();
    if (!flyout || !flyout.isVisible()) return null;
    const svg = flyout.getWorkspace().getParentSvg();
    const rect = svg && svg.getBoundingClientRect();
    return rect && isVisible(rect) ? { flyout, rect } : null;
  }

  function categoryRects(workspace) {
    const toolbox = workspace.getToolbox && workspace.getToolbox();
    if (!toolbox) return [];
    const results = [];
    // Include the groups inside "Advanced", which Blockly keeps as children.
    const items = new Set();
    const collect = (item) => {
      items.add(item);
      if (item.getChildToolboxItems) item.getChildToolboxItems().forEach(collect);
    };
    toolbox.getToolboxItems().forEach(collect);
    for (const item of items) {
      const id = item.getId();
      // The row itself, not the whole group with its children.
      const row = (item.getClickTarget && item.getClickTarget()) || (item.getDiv && item.getDiv());
      if (!TERMS[id] || !row) continue;
      const rect = row.getBoundingClientRect();
      if (isVisible(rect)) results.push([id, rect]);
    }
    return results;
  }

  function show() {
    if (showing) return;
    showing = true;
    glossary.replaceChildren(...GLOSSARY.map(makeLabel).filter(Boolean));
    layer.hidden = false;
    const g = glossary.getBoundingClientRect();
    placed = [{ left: g.left, right: g.right, top: g.top, bottom: g.bottom }];

    document.querySelectorAll("[data-term]").forEach((el) => {
      if (el.id === "workspace") return;
      const rect = el.getBoundingClientRect();
      if (isVisible(rect)) placeLabel(el.dataset.term, rect);
    });
    const workspace = window.workspace;
    if (!workspace) return;
    const seen = new Set();
    const open = openFlyout(workspace);
    if (open) {
      // A block menu is open: explain its blocks in a column beside it.
      for (const [term, rect] of blockRects(open.flyout.getWorkspace(), seen)) {
        placeLabel(term, { ...rect, right: open.rect.right }, true);
      }
      for (const [term, rect] of blockRects(workspace, seen, open.rect)) placeLabel(term, rect);
      return;
    }
    // Explain the group names first when the pointer is over the block menu, otherwise the blocks.
    const toolbox = workspace.getToolbox && workspace.getToolbox();
    const menu = toolbox && toolbox.HtmlDiv && toolbox.HtmlDiv.getBoundingClientRect();
    const overMenu = menu && pointer.x >= menu.left && pointer.x <= menu.right && pointer.y >= menu.top && pointer.y <= menu.bottom;
    const blocks = () => blockRects(workspace, seen).forEach(([term, rect]) => placeLabel(term, rect));
    const groups = () => categoryRects(workspace).forEach(([term, rect]) => placeLabel(term, rect, true));
    if (overMenu) { groups(); blocks(); } else { blocks(); groups(); }
  }

  function hide() {
    if (!showing) return;
    showing = false;
    layer.hidden = true;
    layer.querySelectorAll(".help-label").forEach((el) => {
      if (!glossary.contains(el)) el.remove();
    });
  }

  function isTyping(target) {
    return target instanceof HTMLElement &&
      (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.closest(".blocklyWidgetDiv"));
  }

  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() !== "t" || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTyping(event.target) || document.querySelector("dialog[open]")) return;
    event.preventDefault();
    if (!event.repeat) show();
  });
  document.addEventListener("keyup", (event) => {
    if (event.key.toLowerCase() === "t") hide();
  });
  window.addEventListener("blur", hide);
})();
