let state = createDefaultState();
let pointerDrag = null;
let activeStep = null;
let activeConditionBox = null;
let activeInsert = null;
let suppressStepClick = false;
let suppressLadderClick = false;
let selectedSteps = [];
let selectedCells = [];
let copiedSteps = [];
let selectionBox = null;
let editingLibraryItem = null;
let selectedComponent = null;
let activeConditionTool = "NO";
let activeCellMenu = null;
let activeGridContext = null;
let copiedCells = [];
let edgeBrush = null;
let edgeClickHandledByPointer = false;
let activeCodeToken = "";
let codeSuggestItems = [];
let codeSuggestIndex = 0;
let lastHighlightedCode = "";
let lastHighlightedToken = "";
let activeTargetEditor = null;
let libraryEditPointerDown = false;

const ST_KEYWORDS = new Set([
  "CASE", "OF", "END_CASE", "IF", "THEN", "END_IF", "TRUE", "FALSE", "NOT", "AND", "OR",
  "IN", "PT"
]);
const ST_STRUCT_FIELDS = ["Q", "IN", "PT", "ET", "CV", "PV", "REQ", "DONE", "BUSY", "ERROR", "ENO"];

const LADDER_DEFAULT_ROWS = 1;
const LADDER_DEFAULT_COLS = 3;
const LADDER_MIN_ROWS = 1;
const LADDER_MIN_COLS = 3;
const LADDER_MAIN_ROW = 0;
const LADDER_SQUARE_W = 104;
const LADDER_ROW_H = 36;
const LADDER_TOP_PAD = 8;
const LADDER_LEFT_PAD = 8;

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  restoreState();
  renderAll();
  bindEvents();
});

function bindElements() {
  els.stationScroller = document.getElementById("stationScroller");
  els.codePreview = document.getElementById("codePreview");
  els.codeHighlight = document.getElementById("codeHighlight");
  els.codeLineNumbers = document.getElementById("codeLineNumbers");
  els.codeActiveLine = document.getElementById("codeActiveLine");
  els.codeSuggest = document.getElementById("codeSuggest");
  els.codeStationSelect = document.getElementById("codeStationSelect");
  els.codeFindInput = document.getElementById("codeFindInput");
  els.codeFindPrev = document.getElementById("codeFindPrev");
  els.codeFindNext = document.getElementById("codeFindNext");
  els.codeCursorInfo = document.getElementById("codeCursorInfo");
  els.codeHint = document.getElementById("codeHint");
  els.aiSummary = document.getElementById("aiSummary");
  els.newProjectBtn = document.getElementById("newProjectBtn");
  els.openProjectBtn = document.getElementById("openProjectBtn");
  els.saveProjectBtn = document.getElementById("saveProjectBtn");
  els.importVariablesBtn = document.getElementById("importVariablesBtn");
  els.exportVariablesBtn = document.getElementById("exportVariablesBtn");
  els.compileBtn = document.getElementById("compileBtn");
  els.tidyBtn = document.getElementById("tidyBtn");
  els.toggleVariableBtn = document.getElementById("toggleVariableBtn");
  els.toggleProgramBtn = document.getElementById("toggleProgramBtn");
  els.toggleCodeBtn = document.getElementById("toggleCodeBtn");
  els.clearBtn = document.getElementById("clearBtn");
  els.targetModal = document.getElementById("targetModal");
  els.targetModalTitle = document.getElementById("targetModalTitle");
  els.targetModalMeta = document.getElementById("targetModalMeta");
  els.targetRows = document.getElementById("targetRows");
  els.targetModalClose = document.getElementById("targetModalClose");
  els.targetAddRow = document.getElementById("targetAddRow");
  els.targetSave = document.getElementById("targetSave");
  els.targetSaveFile = document.getElementById("targetSaveFile");
  els.clipboardFallback = document.getElementById("clipboardFallback");
  els.projectFileInput = document.getElementById("projectFileInput");
  els.variableExcelInput = document.getElementById("variableExcelInput");
}

function bindEvents() {
  els.newProjectBtn.addEventListener("click", newProject);
  els.openProjectBtn.addEventListener("click", () => {
    els.projectFileInput.value = "";
    els.projectFileInput.click();
  });
  els.saveProjectBtn.addEventListener("click", downloadProjectFile);
  els.importVariablesBtn.addEventListener("click", () => {
    els.variableExcelInput.value = "";
    els.variableExcelInput.click();
  });
  els.exportVariablesBtn.addEventListener("click", exportVariablesExcel);
  els.projectFileInput.addEventListener("change", handleProjectFileOpen);
  els.variableExcelInput.addEventListener("change", handleVariableExcelImport);

  els.clearBtn.addEventListener("click", () => {
    hideConditionCellUi();
    state = createDefaultState();
    activeStep = null;
    activeConditionBox = null;
    activeInsert = null;
    selectedSteps = [];
    selectedComponent = null;
    localStorage.removeItem(STORAGE_KEY);
    renderAll({ preserveScroll: false });
  });

  els.compileBtn.addEventListener("click", () => {
    hideConditionCellUi();
    compileStationLogic(getCodeStationId());
    saveAndRender();
  });

  els.tidyBtn.addEventListener("click", () => {
    hideConditionCellUi();
    tidyStationLogic(getProgramStationId());
    saveAndRender();
  });

  els.toggleVariableBtn.addEventListener("click", () => {
    hideConditionCellUi();
    state.variableVisible = !state.variableVisible;
    saveAndRender();
  });

  els.toggleProgramBtn.addEventListener("click", () => {
    hideConditionCellUi();
    state.programVisible = !state.programVisible;
    saveAndRender();
  });

  els.toggleCodeBtn.addEventListener("click", () => {
    hideConditionCellUi();
    state.codeVisible = !state.codeVisible;
    saveAndRender();
  });

  els.codePreview.addEventListener("input", () => {
    commitCodeEditorValue(els.codePreview.value);
    updateCodeAutocomplete();
  });
  els.codePreview.addEventListener("scroll", syncCodeHighlightScroll);
  els.codePreview.addEventListener("keydown", handleCodeEditorKeydown);
  ["click", "keyup", "select", "mouseup"].forEach((eventName) => {
    els.codePreview.addEventListener(eventName, () => {
      updateActiveCodeTokenFromEditor();
      updateCodeEditorChrome();
      updateCodeAutocomplete();
    });
  });
  els.codePreview.addEventListener("dblclick", selectCodeTokenAtCaret);
  els.codeStationSelect.addEventListener("change", () => {
    setZoneStation("code", els.codeStationSelect.value);
    closeCodeSuggest();
    saveAndRender();
  });
  els.codeSuggest.addEventListener("mousedown", (event) => {
    const item = event.target.closest("[data-code-suggest-index]");
    if (!item) return;
    event.preventDefault();
    applyCodeSuggestion(Number(item.dataset.codeSuggestIndex));
  });
  els.codeFindInput.addEventListener("input", () => selectCodeFindMatch(1, true));
  els.codeFindInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      selectCodeFindMatch(event.shiftKey ? -1 : 1);
      event.preventDefault();
    }
    if (event.key === "Escape") {
      els.codePreview.focus();
      event.preventDefault();
    }
  });
  els.codeFindPrev.addEventListener("click", () => selectCodeFindMatch(-1));
  els.codeFindNext.addEventListener("click", () => selectCodeFindMatch(1));
  els.targetModalClose.addEventListener("click", closeTargetEditor);
  els.targetModal.addEventListener("click", (event) => {
    if (event.target === els.targetModal) closeTargetEditor();
  });
  els.targetAddRow.addEventListener("click", addTargetEditorRow);
  els.targetSave.addEventListener("click", () => saveTargetEditor(false));
  els.targetSaveFile.addEventListener("click", () => saveTargetEditor(true));
  els.targetRows.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-target-row-remove]");
    if (!remove) return;
    remove.closest(".target-row")?.remove();
    renumberTargetEditorRows();
  });

  els.stationScroller.addEventListener("click", handleStationClick);
  els.stationScroller.addEventListener("dblclick", handleStationDoubleClick);
  els.stationScroller.addEventListener("contextmenu", handleStationContextMenu);
  els.stationScroller.addEventListener("input", handleStationInput);
  els.stationScroller.addEventListener("change", handleStationChange);
  els.stationScroller.addEventListener("focusout", handleStationFocusOut);
  els.stationScroller.addEventListener("keydown", (event) => {
    const nameInput = event.target.closest("[data-library-edit-input]");
    if (nameInput && event.key === "Enter") {
      saveLibraryInput(nameInput);
      event.preventDefault();
    }
  });
  els.stationScroller.addEventListener("pointerdown", (event) => {
    if (event.target.closest("[data-library-rename], [data-library-comment], [data-library-type], [data-library-target]")) {
      libraryEditPointerDown = true;
      event.preventDefault();
      requestAnimationFrame(() => {
        libraryEditPointerDown = false;
      });
    }
  });
  els.stationScroller.addEventListener("pointerdown", (event) => {
    const edge = event.target.closest("[data-cell-edge]");
    if (edge) {
      startCellEdgeBrush(event, edge);
      return;
    }
    const ladderSvg = event.target.closest(".ladder-svg");
    if (ladderSvg && !event.target.closest("button, select, input, .cell-menu, .grid-context-menu, .ladder-selected-editor")) {
      startLadderMarqueeSelect(event, ladderSvg);
      return;
    }
    const card = event.target.closest(".action-card");
    if (card && event.target.closest(".drag-handle")) {
      startExistingActionDrag(event, card);
      return;
    }
    const stepNode = event.target.closest(".flow-step");
    if (stepNode && !event.target.closest("button, select, input, .condition-chip, .ladder-wire, .ladder-svg, .done-icon, .action-card")) {
      startStepDrag(event, stepNode);
      return;
    }
    const canvas = event.target.closest(".flow-canvas");
    if (canvas && !event.target.closest(".flow-step, .flow-arrow, button, select, input")) {
      startMarqueeSelect(event, canvas);
    }
  });
  document.addEventListener("pointerdown", handlePaneResizePointerDown);

  document.addEventListener("keydown", (event) => {
    if (event.target.closest("textarea, input, select")) return;
    const command = event.metaKey || event.ctrlKey;
    if (command && event.key.toLowerCase() === "c") {
      if (!copySelectedCell()) copySelectedSteps();
      event.preventDefault();
    }
    if (command && event.key.toLowerCase() === "v") {
      if (!pasteCopiedCell()) pasteCopiedSteps();
      event.preventDefault();
    }
    if ((event.key === "Delete" || event.key === "Backspace")) {
      if (!deleteSelectedComponent()) deleteSelectedSteps(activeStep?.stationId || getProgramStationId());
      saveAndRender();
      event.preventDefault();
    }
  });
}

function handleStationInput(event) {
  const stepComment = event.target.closest("[data-step-comment]");
  if (stepComment) updateStepComment(stepComment);
  const stepSystemNo = event.target.closest("[data-step-system-no]");
  if (stepSystemNo) updateStepSystemNo(stepSystemNo);
}

function createDefaultState() {
  const stations = {};
  projectData.stations.forEach((station) => {
    stations[station.id] = createStationWork();
  });
  return {
    currentStationId: projectData.stations[0].id,
    variableStationId: projectData.stations[0].id,
    programStationId: projectData.stations[0].id,
    codeStationId: projectData.stations[0].id,
    variableStationPinned: false,
    codeStationPinned: false,
    variableVisible: true,
    programVisible: true,
    codeVisible: true,
    visibleStationIds: [],
    globalVariables: [],
    globalNames: {},
    globalComments: {},
    globalTypes: {},
    globalTargets: {},
    layout: { libraryWidth: 240, codeWidth: 360 },
    stations
  };
}

function createStationWork(overrides = {}) {
  return {
    steps: [],
    arrows: [],
    libraryOpen: { actuator: true, sensor: true, system: true, delay: true, local: true, global: true },
    customItems: { actuator: [], sensor: [], system: [], delay: [] },
    itemNames: {},
    itemComments: {},
    itemTypes: {},
    itemTargets: {},
    localVariables: [],
    aiCompleted: false,
    aiSummary: [],
    codeOverride: "",
    codeEdited: false,
    ...overrides
  };
}

function createStep(overrides = {}) {
  return {
    id: uid("step"),
    systemNo: null,
    comment: "",
    forceActionArea: false,
    hasConditionBox: false,
    conditions: [],
    branches: {},
    ladder: null,
    actions: [],
    ai: null,
    ...overrides
  };
}

function createCondition(item) {
  const condition = createConditionElement(item.defaultContact || "NO");
  bindConditionToSource(condition, "sensor", item);
  return condition;
}

function createConditionElement(contact = "NO") {
  return {
    id: uid("cond"),
    kind: "contact",
    contact,
    binding: null,
    name: "?",
    address: "",
    expression: "",
    pointId: "",
    points: [],
    valueType: "BOOL",
    compareOp: ">",
    compareValue: "0"
  };
}

function createWireElement() {
  return {
    id: uid("wire"),
    kind: "wire"
  };
}

function createVerticalWireElement(direction = "down") {
  return {
    id: uid("vwire"),
    kind: "vwire",
    direction
  };
}

function createLadderElement(kind, row, col) {
  const base = {
    id: uid(kind === "vwire" ? "vwire" : kind === "wire" ? "wire" : "cond"),
    kind,
    row,
    col
  };
  if (kind === "contact") return { ...base, ...createConditionElement(activeConditionTool), row, col };
  if (kind === "vwire") return { ...base, direction: activeConditionTool === "up" ? "up" : "down" };
  return base;
}

function createEmptyLadder(rows = LADDER_DEFAULT_ROWS, cols = LADDER_DEFAULT_COLS) {
  return {
    rows,
    cols,
    elements: [],
    cells: []
  };
}

function createLadderCell(row, col, value = "empty") {
  return {
    id: uid("cell"),
    kind: "cell",
    type: "square",
    row,
    col,
    value,
    leftVertical: false,
    rightVertical: false,
    leftSegments: [false, false],
    rightSegments: [false, false],
    binding: null,
    name: "",
    address: "",
    expression: "",
    pointId: "",
    points: [],
    valueType: "BOOL",
    compareOp: "",
    compareValue: ""
  };
}

function createAction(device, option) {
  return {
    id: uid("act"),
    deviceId: device.id,
    deviceName: device.name,
    type: device.type,
    options: device.actions.map((action) => ({
      id: action.id,
      label: action.label,
      command: action.command,
      done: action.done
    })),
    actionId: option.id,
    actionLabel: option.label,
    command: option.command,
    done: option.done,
    waitDone: true,
    timeoutMs: defaultTimeout(device.type),
    alarm: `${device.name}${option.label}超时`
  };
}

function createDelayAction(durationMs, name = "延时导通") {
  return {
    id: uid("act"),
    deviceId: "delay",
    deviceName: name,
    type: "delay",
    actionId: "delay",
    actionLabel: `${durationMs} ms`,
    command: `Start_Timer(T_${durationMs}, ${durationMs})`,
    done: `T_${durationMs}.Q`,
    waitDone: true,
    durationMs,
    timeoutMs: durationMs + 1000,
    alarm: `${name}未完成`
  };
}

function cloneAction(action) {
  return JSON.parse(JSON.stringify(action));
}

function renderAll(options = {}) {
  const preserveScroll = options.preserveScroll !== false;
  const scroll = preserveScroll ? captureScrollState() : null;
  document.body.classList.toggle("variable-hidden", !state.variableVisible);
  document.body.classList.toggle("code-hidden", !state.codeVisible);
  document.body.classList.toggle("program-hidden", !state.programVisible);
  document.body.classList.toggle("station-hidden", !state.variableVisible && !state.programVisible);
  applyLayoutVars();
  els.stationScroller.innerHTML = renderStationWorkspaces();
  syncCanvasNodeWidth();
  renderCodePreview();
  renderAiSummary();
  updateCodeEditBadges();
  if (scroll) restoreScrollState(scroll);
}

function getVisibleStations() {
  const ids = [getProgramStationId()];
  return ids.slice(0, 2).map(getStation).filter(Boolean);
}

function renderStationWorkspaces() {
  return getVisibleStations().map((station) => renderStationWorkspace(station, getStation(getVariableStationId()))).join("");
}

function renderStationWorkspace(station, variableStation = station) {
  const work = getWork(station.id);
  ensureStepSystemNumbers(work);
  const active = state.currentStationId === station.id ? " is-active-station" : "";
  const edited = work.codeEdited ? " has-code-edit" : "";
  return `
    <section class="station-workspace${active}${edited}" data-station-id="${station.id}">
      <aside class="library-panel station-library" data-variable-station-id="${variableStation.id}">
        <div class="panel-head station-head">
          <select class="station-inline-select" data-zone-station-select="variable" aria-label="选择变量工站">
            ${renderStationOptions(variableStation.id)}
          </select>
          <p>变量区</p>
        </div>
        <div class="library-groups">
          ${renderLibraryGroup(variableStation.id, "执行器", "actuator", getLibraryItems(variableStation.id, "actuator"), true)}
          ${renderLibraryGroup(variableStation.id, "传感器", "sensor", getLibraryItems(variableStation.id, "sensor"), true)}
          ${renderLibraryGroup(variableStation.id, "系统变量", "system", getLibraryItems(variableStation.id, "system"), true)}
          ${renderLibraryGroup(variableStation.id, "定时器", "delay", getLibraryItems(variableStation.id, "delay"), true)}
          ${renderLibraryGroup(variableStation.id, "局部变量", "local", getLibraryItems(variableStation.id, "local"), true)}
          ${renderLibraryGroup(variableStation.id, "全局变量", "global", getLibraryItems(variableStation.id, "global"), true)}
        </div>
      </aside>
      <div class="pane-resizer station-resizer" data-resizer="station" title="调整画布宽度"></div>
      <section class="canvas-panel station-program">
        <div class="panel-head canvas-head">
          <div class="canvas-titlebar">
            <h2>程序流</h2>
            <select class="station-inline-select" data-zone-station-select="program" aria-label="选择程序工站">
              ${renderStationOptions(station.id)}
            </select>
            <div class="canvas-actions">
              <button class="secondary small icon-button" data-station-action="add-condition" title="添加条件框" aria-label="添加条件框"><svg class="tool-svg"><use href="#i-condition"></use></svg></button>
              <button class="secondary small icon-button" data-station-action="add-step" title="添加动作步" aria-label="添加动作步"><svg class="tool-svg"><use href="#i-action"></use></svg></button>
              <button class="secondary small icon-button" data-station-action="copy-selected" title="复制选中" aria-label="复制选中"><svg class="tool-svg"><use href="#i-copy"></use></svg></button>
              <button class="secondary small icon-button" data-station-action="paste-selected" title="粘贴" aria-label="粘贴"><svg class="tool-svg"><use href="#i-paste"></use></svg></button>
              <button class="secondary small icon-button danger-inline" data-station-action="delete-selected" title="删除选中" aria-label="删除选中"><svg class="tool-svg"><use href="#i-trash"></use></svg></button>
            </div>
          </div>
        </div>
        <div class="flow-canvas" data-station-canvas="${station.id}">
          ${renderCanvas(station.id)}
        </div>
      </section>
    </section>
  `;
}

function renderStationOptions(selectedId = state.currentStationId) {
  return projectData.stations
    .map((station) => `<option value="${station.id}" ${station.id === selectedId ? "selected" : ""}>${escapeHtml(station.name)}</option>`)
    .join("");
}

function renderLibraryGroup(stationId, title, kind, items, addable = false) {
  const open = getWork(stationId).libraryOpen[kind] !== false;
  const body = items
    .map((item) => renderLibraryItem(stationId, kind, item))
    .join("");
  return `
    <section class="library-group${open ? "" : " is-collapsed"}">
      <button class="library-title" data-library-toggle="${kind}">
        <span>${escapeHtml(title)}</span>
        <span>
          ${addable ? `<b class="add-variable" data-library-add="${kind}" title="添加控件">+</b>` : ""}
          ${items.length}
        </span>
      </button>
      <div class="library-list">${body}</div>
    </section>
  `;
}

function renderLibraryItem(stationId, kind, item) {
  const className = kind === "actuator" ? item.type : kind;
  return `
    <div class="library-item ${className}" data-station-id="${stationId}" data-kind="${kind}" data-id="${item.id}">
      <span class="library-item-text">${renderLibraryItemText(stationId, kind, item)}</span>
      <span class="library-edit-buttons">
        <button class="library-rename" data-library-rename title="修改名称">名</button>
        <button class="library-rename" data-library-comment title="修改注释">注</button>
        ${(kind === "actuator" || isVariableKind(kind)) ? `<button class="library-rename" data-library-type title="修改类型">类</button>` : ""}
        ${kind === "actuator" ? `<button class="library-rename" data-library-target title="修改目标">目</button>` : ""}
      </span>
    </div>
  `;
}

function renderLibraryItemText(stationId, kind, item) {
  const typeText = getLibraryTypeText(kind, item);
  const targetText = kind === "actuator" ? getTargetText(item) : "";
  const meta = getLibraryMetaText(kind, item);
  const editingName = isEditingLibraryField(stationId, kind, item.id, "name");
  const editingComment = isEditingLibraryField(stationId, kind, item.id, "comment");
  const editingType = isEditingLibraryField(stationId, kind, item.id, "type");
  const editingTargets = false;
  return `
    ${
      editingName
        ? `<input class="library-name-input" data-library-edit-input data-library-name-input value="${escapeHtml(item.name)}" />`
        : `<strong>${escapeHtml(item.name)}</strong>`
    }
    ${
      editingComment
        ? `<input class="library-comment-input" data-library-edit-input data-library-comment-input value="${escapeHtml(meta)}" />`
        : `<small>${escapeHtml([typeText, meta].filter(Boolean).join(" · "))}</small>`
    }
    ${
      editingType
        ? renderLibraryTypeEditor(kind, item)
        : ""
    }
    ${
      editingTargets
        ? `<input class="library-target-input" data-library-edit-input data-library-target-input value="${escapeHtml(targetText)}" />`
        : ""
    }
  `;
}

function getLibraryMetaText(kind, item) {
  if (kind === "actuator") return `${getActionLabels(item).length} 目标`;
  return item.comment || item.address || item.type || item.scope || "";
}

function isEditingLibraryField(stationId, kind, id, field) {
  return editingLibraryItem?.stationId === stationId &&
    editingLibraryItem?.kind === kind &&
    editingLibraryItem?.id === id &&
    editingLibraryItem?.field === field;
}

function renderCanvas(stationId) {
  const work = getWork(stationId);
  const coilLinks = getCoilLinks(work);
  if (!work.steps.length && !work.arrows.includes(0)) {
    return `<div class="empty-canvas" data-empty-canvas="${stationId}"></div>`;
  }
  const parts = [];
  if (work.arrows.includes(0)) parts.push(renderFlowArrow(stationId, 0));
  work.steps.forEach((step, index) => {
    parts.push(renderStep(stationId, step, index, coilLinks));
    const coilCount = getStepCoilCount(step);
    if (index < work.steps.length - 1 || work.arrows.includes(index + 1) || coilCount > 0) {
      parts.push(renderFlowArrow(stationId, index + 1, { count: Math.max(1, coilCount), coilDriven: coilCount > 0 }));
    }
  });
  return parts.join("");
}

function renderStep(stationId, step, index, coilLinks = null) {
  const active = selectedSteps.includes(step.id) || (activeStep?.stationId === stationId && activeStep?.stepId === step.id) ? " is-active-step" : "";
  const conditionOnly = step.hasConditionBox && !step.actions.length && !step.forceActionArea ? " is-condition-step" : "";
  const hasConditionBox = step.hasConditionBox ? " has-condition-box" : "";
  const links = coilLinks || getCoilLinks(getWork(stationId));
  const jumpSource = links.some((link) => link.sourceStepId === step.id) ? " is-jump-source" : "";
  const jumpTarget = links.some((link) => link.targetStepId === step.id) ? " is-jump-target" : "";
  return `
    <article class="flow-step${active}${conditionOnly}${hasConditionBox}${jumpSource}${jumpTarget}" data-station-id="${stationId}" data-step-id="${step.id}" data-step-index="${index}">
      <div class="flow-node">
        <div class="step-meta">
          <label>S<input class="step-system-no" data-step-system-no="${step.id}" data-station-id="${stationId}" type="number" min="1" step="1" value="${getStepSystemNo(step, index)}" /></label>
          <input class="step-comment" data-step-comment="${step.id}" data-station-id="${stationId}" value="${escapeHtml(step.comment || "")}" placeholder="节点注释" />
        </div>
        ${step.hasConditionBox ? renderConditionBox(stationId, step) : ""}
        <div class="action-row node-actions ${step.actions.length ? "" : "is-empty"}" data-action-drop="${step.id}">
          ${step.actions.map((action) => renderAction(action, stationId, step.id)).join("")}
        </div>
        ${renderStepJumpLinks(stationId, step.id, links)}
        ${renderStepAi(step)}
      </div>
    </article>
  `;
}

function renderStepJumpLinks(stationId, stepId, links) {
  const outgoing = links.filter((link) => link.sourceStepId === stepId && link.targetStepId);
  if (!outgoing.length) return "";
  return `
    <div class="jump-links">
      ${outgoing.map((link) => `
        <button type="button" data-jump-step="${link.targetStepId}" data-jump-station="${stationId}">
          线圈${link.coilIndex + 1} -> S${link.targetStepNo}
        </button>
      `).join("")}
    </div>
  `;
}

function renderConditionBox(stationId, step) {
  ensureLadderStep(step);
  const active = activeConditionBox?.stationId === stationId && activeConditionBox?.stepId === step.id ? " is-active-rung" : "";
  const hasConditions = step.ladder.cells.some((cell) => cell.value !== "empty") ? " has-conditions" : " has-empty-logic";
  const grid = renderLadderGrid(stationId, step);
  const menu = renderCellMenu(stationId, step);
  const sideTools = renderConditionSideTools(stationId, step);
  const editor = renderSelectedLadderEditor(stationId, step);
  return `
    <div class="condition-row node-condition${hasConditions}${active}" data-condition-box="${step.id}">
      ${menu || editor ? `<div class="condition-box-toolbar">${menu}${editor}</div>` : ""}
      <div class="condition-box-body">
        <div class="ladder-scroll">${grid}</div>
        ${sideTools}
      </div>
    </div>
  `;
}

function renderConditionToolbar(stationId, stepId) {
  const tools = [
    ["NO", "常开", "| |"],
    ["NC", "常闭", "|/|"],
    ["down", "向下分支", "┴"],
    ["up", "向上分支", "┬"],
    ["wire", "横线", "━"],
    ["RISING", "上升沿", "|P|"],
    ["FALLING", "下降沿", "|N|"]
  ];
  return `
    <div class="condition-toolbar" data-condition-toolbar="${stepId}" data-station-id="${stationId}">
      ${tools.map(([tool, label, symbol]) => `
        <button class="${activeConditionTool === tool ? "is-active-tool" : ""}" data-condition-tool="${tool}" title="${label}">
          <span>${symbol}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderLadderGrid(stationId, step) {
  ensureLadderStep(step);
  const ladder = step.ladder;
  const cols = Math.max(ladder.cols, getUsedLadderCols(ladder));
  const rows = Math.max(ladder.rows, getUsedLadderRows(ladder));
  ladder.cols = cols;
  ladder.rows = rows;
  const width = LADDER_LEFT_PAD + ladderGridWidth(cols) + LADDER_LEFT_PAD;
  const height = LADDER_TOP_PAD * 2 + rows * LADDER_ROW_H;
  const parts = [];
  parts.push(`<rect class="ladder-grid-bg" x="0" y="0" width="${width}" height="${height}" />`);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      parts.push(renderLadderGridCell(stationId, step.id, ladder, row, col));
    }
  }
  return `
    <svg class="ladder-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-ladder-svg="${step.id}" role="img" aria-label="梯形图条件框">
      ${parts.join("")}
    </svg>
  `;
}

function renderLadderGridCell(stationId, stepId, ladder, row, col) {
  const cell = findLadderCell(ladder, row, col) || createLadderCell(row, col);
  normalizeCellSegments(cell);
  const rect = ladderCellRect(row, col);
  const midY = rect.y + rect.height / 2;
  const selected = isSelectedCell(stationId, stepId, row, col);
  const selectedClass = selected ? " is-selected-cell" : "";
  return `
    <g class="ladder-cell ${cell.type}${selectedClass}" data-ladder-cell="1" data-cell-type="${cell.type}" data-station-id="${stationId}" data-step-id="${stepId}" data-row="${row}" data-col="${col}">
      <rect class="cell-box" x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}"></rect>
      <line class="cell-edge ${cell.leftSegments[0] ? "is-on" : ""}" data-cell-edge="left" data-cell-segment="top" data-station-id="${stationId}" data-step-id="${stepId}" data-row="${row}" data-col="${col}" x1="${rect.x}" y1="${rect.y}" x2="${rect.x}" y2="${midY}"></line>
      <line class="cell-edge ${cell.leftSegments[1] ? "is-on" : ""}" data-cell-edge="left" data-cell-segment="bottom" data-station-id="${stationId}" data-step-id="${stepId}" data-row="${row}" data-col="${col}" x1="${rect.x}" y1="${midY}" x2="${rect.x}" y2="${rect.y + rect.height}"></line>
      <line class="cell-edge ${cell.rightSegments[0] ? "is-on" : ""}" data-cell-edge="right" data-cell-segment="top" data-station-id="${stationId}" data-step-id="${stepId}" data-row="${row}" data-col="${col}" x1="${rect.x + rect.width}" y1="${rect.y}" x2="${rect.x + rect.width}" y2="${midY}"></line>
      <line class="cell-edge ${cell.rightSegments[1] ? "is-on" : ""}" data-cell-edge="right" data-cell-segment="bottom" data-station-id="${stationId}" data-step-id="${stepId}" data-row="${row}" data-col="${col}" x1="${rect.x + rect.width}" y1="${midY}" x2="${rect.x + rect.width}" y2="${rect.y + rect.height}"></line>
      <rect class="cell-edge-hit" data-cell-edge="left" data-cell-segment="top" data-station-id="${stationId}" data-step-id="${stepId}" data-row="${row}" data-col="${col}" x="${rect.x - 8}" y="${rect.y}" width="16" height="${rect.height / 2}"></rect>
      <rect class="cell-edge-hit" data-cell-edge="left" data-cell-segment="bottom" data-station-id="${stationId}" data-step-id="${stepId}" data-row="${row}" data-col="${col}" x="${rect.x - 8}" y="${midY}" width="16" height="${rect.height / 2}"></rect>
      <rect class="cell-edge-hit" data-cell-edge="right" data-cell-segment="top" data-station-id="${stationId}" data-step-id="${stepId}" data-row="${row}" data-col="${col}" x="${rect.x + rect.width - 8}" y="${rect.y}" width="16" height="${rect.height / 2}"></rect>
      <rect class="cell-edge-hit" data-cell-edge="right" data-cell-segment="bottom" data-station-id="${stationId}" data-step-id="${stepId}" data-row="${row}" data-col="${col}" x="${rect.x + rect.width - 8}" y="${midY}" width="16" height="${rect.height / 2}"></rect>
      <rect class="cell-body-hit" x="${rect.x + 10}" y="${rect.y}" width="${rect.width - 20}" height="${rect.height}"></rect>
      ${renderLadderCellSymbol(cell, rect, stationId, stepId)}
    </g>
  `;
}

function renderLadderCellSymbol(cell, rect, stationId, stepId) {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const pad = 0;
  const attrs = `data-ladder-cell-symbol="${cell.id || `${cell.row}:${cell.col}`}" data-station-id="${stationId}" data-step-id="${stepId}"`;
  if (cell.value === "wire") {
    return `<line class="cell-symbol-line" ${attrs} x1="${rect.x + pad}" y1="${cy}" x2="${rect.x + rect.width - pad}" y2="${cy}"></line>`;
  }
  if (["NO", "NC", "RISING", "FALLING"].includes(cell.value)) {
    const leftX = cx - 8;
    const rightX = cx + 8;
    const top = rect.y + 8;
    const bottom = rect.y + rect.height - 8;
    const slash = cell.value === "NC"
      ? `<line class="cell-symbol-line" x1="${leftX - 6}" y1="${bottom - 1}" x2="${rightX + 6}" y2="${top + 1}"></line>`
      : "";
    const edge = cell.value === "RISING"
      ? `<text class="cell-edge-text" x="${cx}" y="${cy + 6}" text-anchor="middle">P</text>`
      : cell.value === "FALLING"
        ? `<text class="cell-edge-text" x="${cx}" y="${cy + 6}" text-anchor="middle">N</text>`
        : "";
    return `
      <line class="cell-symbol-line" x1="${rect.x}" y1="${cy}" x2="${leftX}" y2="${cy}"></line>
      <line class="cell-symbol-line" x1="${rightX}" y1="${cy}" x2="${rect.x + rect.width}" y2="${cy}"></line>
      <line class="cell-symbol-line" x1="${leftX}" y1="${top}" x2="${leftX}" y2="${bottom}"></line>
      <line class="cell-symbol-line" x1="${rightX}" y1="${top}" x2="${rightX}" y2="${bottom}"></line>
      ${slash}${edge}
      ${renderLadderCellBindingText(cell, rect)}
    `;
  }
  if (cell.value === "coil") {
    const leftInner = cx - 9;
    const leftOuter = cx - 20;
    const rightInner = cx + 9;
    const rightOuter = cx + 20;
    const top = cy - 11;
    const bottom = cy + 11;
    const targetLabel = getCoilTargetLabel(stationId, cell);
    return `
      <line class="cell-symbol-line" x1="${rect.x}" y1="${cy}" x2="${leftOuter}" y2="${cy}"></line>
      <path class="cell-symbol-line no-fill" d="M ${leftInner} ${top} C ${leftOuter} ${cy - 7}, ${leftOuter} ${cy + 7}, ${leftInner} ${bottom}"></path>
      <path class="cell-symbol-line no-fill" d="M ${rightInner} ${top} C ${rightOuter} ${cy - 7}, ${rightOuter} ${cy + 7}, ${rightInner} ${bottom}"></path>
      <line class="cell-symbol-line" x1="${rightOuter}" y1="${cy}" x2="${rect.x + rect.width}" y2="${cy}"></line>
      ${targetLabel ? `<text class="cell-coil-target" x="${cx}" y="${rect.y + rect.height - 3}" text-anchor="middle">${escapeHtml(targetLabel)}</text>` : ""}
    `;
  }
  return "";
}

function getCoilTargetLabel(stationId, cell) {
  if (!cell.targetStepId) return "";
  const work = getWork(stationId);
  const index = work.steps.findIndex((step) => step.id === cell.targetStepId);
  if (index < 0) return "";
  return `-> S${getStepSystemNo(work.steps[index], index)}`;
}

function renderLadderCellBindingText(cell, rect) {
  const isContact = ["NO", "NC", "RISING", "FALLING"].includes(cell.value);
  if (!isContact) return "";
  const cx = rect.x + rect.width / 2;
  const name = cell.binding ? compactLadderText(cell.name || cell.binding.name || "") : "?";
  const detail = cell.binding ? compactLadderText(conditionDetailText(cell) || cell.address || "") : "";
  return `
    <text class="cell-binding-name" x="${cx}" y="${rect.y + 7}" text-anchor="middle">${escapeHtml(name)}</text>
    ${detail ? `<text class="cell-binding-detail" x="${cx}" y="${rect.y + rect.height - 3}" text-anchor="middle">${escapeHtml(detail)}</text>` : ""}
  `;
}

function compactLadderText(value) {
  const text = String(value || "").trim();
  if (text.length <= 12) return text;
  return `${text.slice(0, 11)}...`;
}

function renderLadderSlot(stationId, stepId, row, col, occupied) {
  const { x, y } = ladderCellCenter(row, col);
  const active = activeInsert?.stationId === stationId &&
    activeInsert?.stepId === stepId &&
    activeInsert?.row === row &&
    activeInsert?.col === col ? " is-active-slot" : "";
  return `
    <g class="svg-ladder-slot${occupied ? " is-occupied" : ""}${active}" data-ladder-slot="1" data-station-id="${stationId}" data-step-id="${stepId}" data-row="${row}" data-col="${col}">
      <rect x="${x - 34}" y="${y - 15}" width="68" height="30" rx="5"></rect>
      <text x="${x}" y="${y + 4}" text-anchor="middle">插入</text>
    </g>
  `;
}

function getVisibleLadderSlots(ladder, rows, cols) {
  const keys = new Set();
  const add = (row, col) => {
    if (row < 0 || row >= rows || col < 0 || col >= cols) return;
    if (findLadderElementAt(ladder, row, col)) return;
    keys.add(`${row}:${col}`);
  };
  ladder.elements.forEach((element) => {
    add(element.row, element.col - 1);
    add(element.row, element.col + 1);
    if (element.kind === "vwire") add(element.direction === "up" ? element.row - 1 : element.row + 1, element.col);
  });
  if (Number.isFinite(activeInsert?.row) && Number.isFinite(activeInsert?.col)) add(activeInsert.row, activeInsert.col);
  return [...keys].map((key) => {
    const [row, col] = key.split(":").map(Number);
    return { row, col };
  });
}

function renderSvgLadderElement(element, stationId, stepId) {
  const { x, y } = ladderCellCenter(element.row, element.col);
  const selected = isSelectedComponent("condition", stationId, stepId, element.id) || isSelectedComponent("ladder", stationId, stepId, element.id);
  const selectedClass = selected ? " is-selected-component" : "";
  const attrs = `data-ladder-element="${element.id}" data-ladder-kind="${element.kind}" data-condition-id="${element.id}" data-station-id="${stationId}" data-step-id="${stepId}"`;
  if (element.kind === "wire") {
    return `
      <g class="svg-ladder-element svg-wire${selectedClass}" ${attrs}>
        <line x1="${x - 45}" y1="${y}" x2="${x + 45}" y2="${y}"></line>
      </g>
    `;
  }
  if (element.kind === "vwire") {
    const y2 = element.direction === "up" ? y - LADDER_ROW_H : y + LADDER_ROW_H;
    return `
      <g class="svg-ladder-element svg-vwire${selectedClass}" ${attrs}>
        <line x1="${x}" y1="${Math.min(y, y2)}" x2="${x}" y2="${Math.max(y, y2)}"></line>
      </g>
    `;
  }
  const symbol = contactSymbol(element.contact);
  const name = element.binding ? element.name : "?";
  const detail = element.binding ? conditionDetailText(element) : "";
  return `
    <g class="svg-ladder-element svg-contact${element.binding ? "" : " is-unbound"}${selectedClass}" ${attrs}>
      <line x1="${x - 48}" y1="${y}" x2="${x - 22}" y2="${y}"></line>
      <line x1="${x + 22}" y1="${y}" x2="${x + 48}" y2="${y}"></line>
      <rect x="${x - 31}" y="${y - 27}" width="62" height="54" rx="5"></rect>
      <text class="svg-contact-name" x="${x}" y="${y - 18}" text-anchor="middle">${escapeHtml(name)}</text>
      <text class="svg-contact-symbol" x="${x}" y="${y + 7}" text-anchor="middle">${escapeHtml(symbol)}</text>
      <text class="svg-contact-detail" x="${x}" y="${y + 23}" text-anchor="middle">${escapeHtml(detail)}</text>
    </g>
  `;
}

function renderSelectedLadderEditor(stationId, step) {
  if (!selectedComponent || selectedComponent.stationId !== stationId || selectedComponent.stepId !== step.id) return "";
  let condition = findConditionById(step, selectedComponent.id);
  if (!condition && selectedComponent.type === "ladderCell") {
    const position = getSelectedCellPosition(stationId, step.id);
    condition = position ? findLadderCell(ensureLadderStep(step), position.row, position.col) : null;
  }
  if (!condition || !["NO", "NC", "RISING", "FALLING"].includes(condition.value || condition.contact)) return "";
  const points = getConditionSelectablePoints(condition);
  const showPointSelect = points.length > 1;
  const showCompare = needsCompare(condition);
  if (!showPointSelect && !showCompare) return "";
  return `
    <div class="ladder-selected-editor" data-condition-id="${condition.id}" data-station-id="${stationId}" data-step-id="${step.id}">
      ${showPointSelect ? renderConditionPointSelect(condition) : ""}
      ${showCompare ? renderCompareControls(condition) : ""}
    </div>
  `;
}

function renderCellMenu(stationId, step) {
  const context = getActiveCellContext(stationId, step.id);
  if (!context) return "";
  const ladder = ensureLadderStep(step);
  const cell = findLadderCell(ladder, context.row, context.col) || createLadderCell(context.row, context.col);
  if (cell.type !== "square") return "";
  const options = [
    ["empty", "空"],
    ["NO", "常开"],
    ["NC", "常闭"],
    ["wire", "横线"],
    ["RISING", "上升沿"],
    ["FALLING", "下降沿"],
    ["coil", "线圈"]
  ];
  return `
    <div class="cell-menu condition-cell-toolbar" data-cell-menu="1">
      ${options.map(([value, label]) => `<button class="${cell.value === value ? "is-active" : ""}" data-cell-menu-value="${value}">${label}</button>`).join("")}
    </div>
  `;
}

function renderGridContextMenu(stationId, step) {
  if (!activeGridContext || activeGridContext.stationId !== stationId || activeGridContext.stepId !== step.id) return "";
  const rect = ladderCellRect(activeGridContext.row, activeGridContext.col);
  const ladder = ensureLadderStep(step);
  const left = Math.min(rect.x + rect.width + 10, Math.max(0, LADDER_LEFT_PAD + ladderGridWidth(ladder.cols) - 168));
  const top = rect.y + rect.height + 6;
  return `
    <div class="grid-context-menu" style="left:${left}px;top:${top}px" data-grid-context="1">
      <label>数量 <input data-grid-insert-count type="number" min="1" max="12" value="${activeGridContext.count || 1}" /></label>
      <button data-grid-insert="up">向上插入</button>
      <button data-grid-insert="down">向下插入</button>
      <button data-grid-insert="left">向左插入</button>
      <button data-grid-insert="right">向右插入</button>
      <button data-grid-action="copy">复制格子</button>
      <button data-grid-action="paste">粘贴格子</button>
      <button data-grid-action="delete-row">删除行</button>
      <button data-grid-action="delete-col">删除列</button>
    </div>
  `;
}

function renderConditionSideTools(stationId, step) {
  const context = getActiveCellContext(stationId, step.id);
  if (!context) return "";
  const cell = findLadderCell(ensureLadderStep(step), context.row, context.col);
  const coilTarget = cell?.value === "coil" ? renderCoilTargetSelect(stationId, cell) : "";
  return `
    <div class="condition-side-tools" data-grid-context="1">
      ${coilTarget}
      <label>数量 <input data-grid-insert-count type="number" min="1" max="12" value="${activeGridContext?.count || 1}" /></label>
      <button data-grid-insert="up">上插</button>
      <button data-grid-insert="down">下插</button>
      <button data-grid-insert="left">左插</button>
      <button data-grid-insert="right">右插</button>
      <button data-grid-action="copy">复制</button>
      <button data-grid-action="paste">粘贴</button>
      <button data-grid-action="delete-row">删行</button>
      <button data-grid-action="delete-col">删列</button>
    </div>
  `;
}

function renderCoilTargetSelect(stationId, cell) {
  const work = getWork(stationId);
  ensureStepSystemNumbers(work);
  const options = work.steps
    .map((step, index) => {
      const selected = cell.targetStepId === step.id ? "selected" : "";
      return `<option value="${step.id}" ${selected}>S${getStepSystemNo(step, index)}</option>`;
    })
    .join("");
  return `
    <label class="coil-target-control">跳转
      <select data-coil-target>
        <option value="">下一步</option>
        ${options}
      </select>
    </label>
    ${cell.targetStepId ? `<button data-jump-step="${cell.targetStepId}" data-jump-station="${stationId}" type="button">跳转</button>` : ""}
  `;
}

function getActiveCellContext(stationId, stepId) {
  if (activeCellMenu?.stationId === stationId && activeCellMenu.stepId === stepId) {
    return activeCellMenu;
  }
  const position = getSelectedCellPosition(stationId, stepId);
  if (position) return { stationId, stepId, row: position.row, col: position.col };
  return null;
}

function renderInsertSlot(stationId, stepId, lane, index, options = {}) {
  const active = activeInsert?.stationId === stationId &&
    activeInsert?.stepId === stepId &&
    activeInsert?.lane === lane &&
    activeInsert?.index === index ? " is-active-slot" : "";
  const style = options.column ? ` style="grid-column:${options.column};grid-row:${options.row || 1}"` : "";
  const compact = options.compact ? " is-compact-slot" : "";
  const wide = options.wide ? " is-wide-slot" : "";
  return `
    <button class="insert-slot${active}${compact}${wide}"${style} data-insert-slot="${index}" data-insert-lane="${lane}" data-station-id="${stationId}" data-step-id="${stepId}">
      插入
    </button>
  `;
}

function buildLadderColumns(count) {
  const columns = ["2px"];
  for (let index = 0; index < count; index += 1) {
    columns.push("58px");
    columns.push("112px");
  }
  columns.push("58px");
  columns.push("2px");
  return columns.join(" ");
}

function ladderCellCenter(row, col) {
  const rect = ladderCellRect(row, col);
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };
}

function ladderCellType(col) {
  return "square";
}

function ladderColWidth(col) {
  return LADDER_SQUARE_W;
}

function ladderColX(col) {
  let x = LADDER_LEFT_PAD;
  for (let index = 0; index < col; index += 1) x += ladderColWidth(index);
  return x;
}

function ladderGridWidth(cols) {
  let width = 0;
  for (let col = 0; col < cols; col += 1) width += ladderColWidth(col);
  return width;
}

function ladderCellRect(row, col) {
  return {
    x: ladderColX(col),
    y: LADDER_TOP_PAD + row * LADDER_ROW_H,
    width: ladderColWidth(col),
    height: LADDER_ROW_H
  };
}

function isSelectedCell(stationId, stepId, row, col) {
  if (selectedComponent?.type === "ladderCell" &&
    selectedComponent.stationId === stationId &&
    selectedComponent.stepId === stepId &&
    selectedComponent.id === `${row}:${col}`) return true;
  if (selectedCells.some((cell) =>
    cell.stationId === stationId &&
    cell.stepId === stepId &&
    cell.row === row &&
    cell.col === col
  )) return true;
  return false;
}

function findLadderCell(ladder, row, col) {
  return ladder.cells?.find((cell) => Number(cell.row) === row && Number(cell.col) === col);
}

function ensureLadderCell(ladder, row, col) {
  if (!Array.isArray(ladder.cells)) ladder.cells = [];
  let cell = findLadderCell(ladder, row, col);
  if (!cell) {
    cell = createLadderCell(row, col);
    ladder.cells.push(cell);
  }
  return cell;
}

function findLadderElementAt(ladder, row, col) {
  return ladder.elements.find((element) => Number(element.row) === row && Number(element.col) === col);
}

function getUsedLadderCols(ladder) {
  const elementMax = (ladder.elements || []).reduce((max, element) => Math.max(max, Number(element.col) || 0), LADDER_DEFAULT_COLS - 1);
  const cellMax = (ladder.cells || [])
    .filter(isUsedLadderCell)
    .reduce((max, cell) => Math.max(max, Number(cell.col) || 0), LADDER_DEFAULT_COLS - 1);
  const maxCol = Math.max(elementMax, cellMax);
  return Math.max(LADDER_DEFAULT_COLS, maxCol + 1);
}

function getUsedLadderRows(ladder) {
  const elementMax = (ladder.elements || []).reduce((max, element) => Math.max(max, Number(element.row) || 0), LADDER_DEFAULT_ROWS - 1);
  const cellMax = (ladder.cells || [])
    .filter(isUsedLadderCell)
    .reduce((max, cell) => Math.max(max, Number(cell.row) || 0), LADDER_DEFAULT_ROWS - 1);
  const maxRow = Math.max(elementMax, cellMax);
  return Math.max(LADDER_DEFAULT_ROWS, maxRow + 1);
}

function getLadderRowCount(step) {
  const hasBranch = Object.values(step.branches || {}).some((branch) => hasBranchLane(branch, "up") || hasBranchLane(branch, "down"));
  return hasBranch ? 3 : 1;
}

function renderLadderWire(stationId, step, index, column, row = 1) {
  const branch = step.branches?.[index] || {};
  const active = isSelectedComponent("wire", stationId, step.id, String(index)) ? " is-selected-component" : "";
  const branchClass = `${hasBranchLane(branch, "up") ? " branch-up" : ""}${hasBranchLane(branch, "down") ? " branch-down" : ""}`;
  const style = column ? ` style="grid-column:${column};grid-row:${row}"` : "";
  return `
    <span class="ladder-wire${active}${branchClass}"${style} data-wire-index="${index}" data-station-id="${stationId}" data-step-id="${step.id}">
      <span class="wire-line"></span>
      <span class="wire-tools">
        <button data-wire-branch="up" title="上竖线">┬</button>
        <button data-wire-branch="down" title="下竖线">┴</button>
      </span>
    </span>
  `;
}

function renderBranchTrack(stationId, step, index, lane) {
  const branch = step.branches?.[index];
  if (!hasBranchLane(branch, lane)) return "";
  const row = lane === "up" ? 1 : 3;
  const conditions = getBranchConditions(branch, lane);
  const id = `${index}:${lane}`;
  const active = isSelectedComponent("branch", stationId, step.id, id) ? " is-selected-component" : "";
  const columnStart = 3 + index * 2;
  const columnEnd = columnStart + 4;
  return `
    <div class="ladder-branch ${lane}${active}" style="grid-column:${columnStart} / ${columnEnd};grid-row:${row}" data-branch-index="${index}" data-branch-lane="${lane}" data-station-id="${stationId}" data-step-id="${step.id}">
      <span class="branch-wire"></span>
      <span class="branch-contacts">
        ${
          conditions.length
            ? `${conditions.map((condition) => renderConditionElement(condition, stationId, step.id, { branchIndex: index, branchLane: lane })).join("")}${renderInsertSlot(stationId, step.id, `${index}:${lane}`, conditions.length, { compact: true })}`
            : renderInsertSlot(stationId, step.id, `${index}:${lane}`, 0, { wide: true })
        }
      </span>
    </div>
  `;
}

function renderFlowArrow(stationId, index, options = {}) {
  const active = activeInsert?.stationId === stationId && activeInsert?.index === index ? " is-active-insert" : "";
  const count = Math.max(1, Number(options.count) || 1);
  const coilClass = options.coilDriven ? " is-coil-driven" : "";
  const spans = Array.from({ length: count }, (_, arrowIndex) => {
    const left = count === 1 ? 50 : 50 + (arrowIndex - (count - 1) / 2) * 16;
    return `<span style="left:${left}%"></span>`;
  }).join("");
  return `
    <div class="flow-arrow${active}${coilClass}" data-flow-arrow="${index}" data-station-id="${stationId}" title="${options.coilDriven ? `${count} 个线圈输出` : ""}">
      ${spans}
    </div>
  `;
}

function renderConditionElement(condition, stationId, stepId, options = {}) {
  if (condition.kind === "wire") return renderInlineWire(condition, stationId, stepId, options);
  const active = isSelectedComponent("condition", stationId, stepId, condition.id) ? " is-selected-component" : "";
  const branchAttrs = Number.isInteger(options.branchIndex)
    ? ` data-branch-index="${options.branchIndex}" data-branch-lane="${options.branchLane}"`
    : "";
  const style = options.column ? ` style="grid-column:${options.column};grid-row:${options.row || 1}"` : "";
  const unbound = condition.binding ? "" : " is-unbound";
  const klass = condition.contact === "NC" ? `condition-chip nc${active}${unbound}` : `condition-chip${active}${unbound}`;
  const symbol = contactSymbol(condition.contact);
  const points = getConditionSelectablePoints(condition);
  const showPointSelect = active && points.length > 1;
  const showCompare = active && needsCompare(condition);
  const detail = condition.binding
    ? conditionDetailText(condition)
    : "先选中后单击左侧器件";
  return `
    <span class="${klass}"${style} data-condition-id="${condition.id}" data-station-id="${stationId}" data-step-id="${stepId}"${branchAttrs}>
      <span class="contact-name">${escapeHtml(condition.name || "?")}</span>
      <span class="contact">${symbol}</span>
      <span class="contact-address">${escapeHtml(detail)}</span>
      ${showPointSelect ? renderConditionPointSelect(condition) : ""}
      ${showCompare ? renderCompareControls(condition) : ""}
    </span>
  `;
}

function renderInlineWire(condition, stationId, stepId, options = {}) {
  const active = isSelectedComponent("condition", stationId, stepId, condition.id) ? " is-selected-component" : "";
  const branchAttrs = Number.isInteger(options.branchIndex)
    ? ` data-branch-index="${options.branchIndex}" data-branch-lane="${options.branchLane}"`
    : "";
  const style = options.column ? ` style="grid-column:${options.column};grid-row:${options.row || 1}"` : "";
  return `
    <span class="condition-wire-block${active}"${style} data-condition-id="${condition.id}" data-station-id="${stationId}" data-step-id="${stepId}"${branchAttrs}>
      <span></span>
    </span>
  `;
}

function renderConditionPointSelect(condition) {
  return `
    <select class="condition-point-select" data-condition-point="${condition.id}">
      ${condition.points.map((point) => `<option value="${point.id}" ${point.id === condition.pointId ? "selected" : ""}>${escapeHtml(point.label)}</option>`).join("")}
    </select>
  `;
}

function renderCompareControls(condition) {
  const ops = compareOpsForType(condition.valueType);
  return `
    <span class="compare-controls">
      <select data-compare-op="${condition.id}">
        ${ops.map((op) => `<option value="${op}" ${op === condition.compareOp ? "selected" : ""}>${op}</option>`).join("")}
      </select>
      <input data-compare-value="${condition.id}" value="${escapeHtml(condition.compareValue ?? "")}" />
    </span>
  `;
}

function renderAction(action, stationId, stepId) {
  ensureActionOptions(action);
  const actionControl =
    action.type === "delay"
      ? `<input class="inline-duration" data-duration-action="${action.id}" type="number" min="100" step="100" value="${action.durationMs || 1000}" />`
      : `<select class="inline-action-select" data-select-action="${action.id}">
          ${(action.options || [])
            .map((option) => `<option value="${option.id}" ${option.id === action.actionId ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
            .join("")}
        </select>`;
  const doneTitle = action.done && action.done !== "TRUE" ? `完成条件: ${action.done}` : "无需完成条件";
  const doneOn = action.waitDone !== false;
  const active = isSelectedComponent("action", stationId, stepId, action.id) ? " is-selected-component" : "";
  return `
    <div class="action-card ${action.type}${active}" data-action-id="${action.id}" data-station-id="${stationId}" data-step-id="${stepId}">
      <div class="action-main">
        <span class="drag-handle" title="拖动动作">⋮⋮</span>
        <strong>${escapeHtml(action.deviceName)}</strong>
        ${actionControl}
        <button class="done-icon ${doneOn ? "" : "is-off"}" data-toggle-wait="${action.id}" title="${escapeHtml(doneOn ? `${doneTitle}，点击取消` : "完成条件已取消，点击启用")}">${doneOn ? "✓" : "○"}</button>
      </div>
    </div>
  `;
}

function renderStepAi(step) {
  if (!step.ai) return "";
  return `
    <div class="ai-line">
      <span class="ai-pill">完成 ${step.ai.doneCount}</span>
      <span class="ai-pill">超时 ${step.ai.timeoutCount}</span>
      <span class="ai-pill">报警 ${step.ai.alarmCount}</span>
      <span class="ai-pill">下一步 ${step.ai.nextStep || "结束"}</span>
    </div>
  `;
}

function handleStationClick(event) {
  const stationNode = event.target.closest(".station-workspace");
  if (!stationNode) return;
  setActiveStation(stationNode.dataset.stationId);
  if (suppressLadderClick && event.target.closest(".ladder-svg")) {
    suppressLadderClick = false;
    return;
  }
  const closedOverlay = closeFloatingEditorsForClick(event);
  if (closedOverlay && !event.target.closest("[data-ladder-cell], [data-grid-context], [data-cell-menu], .ladder-selected-editor, button, select, input, .library-item, .action-card, .flow-step, [data-condition-id], [data-ladder-element], [data-wire-index]")) {
    renderAll();
    return;
  }

  const renameButton = event.target.closest("[data-library-rename]");
  if (renameButton) {
    event.stopPropagation();
    beginLibraryInlineEdit(renameButton.closest(".library-item"), "name");
    return;
  }

  const commentButton = event.target.closest("[data-library-comment]");
  if (commentButton) {
    event.stopPropagation();
    beginLibraryInlineEdit(commentButton.closest(".library-item"), "comment");
    return;
  }

  const typeButton = event.target.closest("[data-library-type]");
  if (typeButton) {
    event.stopPropagation();
    beginLibraryInlineEdit(typeButton.closest(".library-item"), "type");
    return;
  }

  const targetButton = event.target.closest("[data-library-target]");
  if (targetButton) {
    event.stopPropagation();
    const activeInput = els.stationScroller.querySelector("[data-library-edit-input]");
    if (activeInput && editingLibraryItem) saveLibraryInput(activeInput, { render: false });
    const itemNode = targetButton.closest(".library-item");
    openTargetEditor(itemNode);
    return;
  }

  const addLibraryItem = event.target.closest("[data-library-add]");
  if (addLibraryItem) {
    event.stopPropagation();
    const libraryStationId = addLibraryItem.closest("[data-variable-station-id]")?.dataset.variableStationId || stationNode.dataset.stationId;
    addCustomLibraryItem(libraryStationId, addLibraryItem.dataset.libraryAdd);
    saveAndRender();
    return;
  }

  const libraryItem = event.target.closest(".library-item");
  if (libraryItem && tryBindSelectedCondition(libraryItem)) {
    return;
  }
  if (libraryItem) {
    if (activeConditionBox?.stationId === libraryItem.dataset.stationId) {
      setSummaryMessage("先选中条件触点，再单击器件绑定条件。");
    }
    return;
  }

  const toggle = event.target.closest("[data-library-toggle]");
  if (toggle) {
    const libraryStationId = toggle.closest("[data-variable-station-id]")?.dataset.variableStationId || stationNode.dataset.stationId;
    const work = getWork(libraryStationId);
    const kind = toggle.dataset.libraryToggle;
    work.libraryOpen[kind] = work.libraryOpen[kind] === false;
    saveAndRender();
    return;
  }

  const stationAction = event.target.closest("[data-station-action]");
  if (stationAction) {
    activeCellMenu = null;
    activeGridContext = null;
    if (stationAction.dataset.stationAction === "add-condition") {
      addConditionBoxFromToolbar(stationNode.dataset.stationId);
      saveAndRender();
      return;
    }
    if (stationAction.dataset.stationAction === "add-step") {
      addActionStepFromToolbar(stationNode.dataset.stationId);
      saveAndRender();
      return;
    }
    if (stationAction.dataset.stationAction === "delete-selected") {
      deleteSelectedSteps(stationNode.dataset.stationId);
    }
    if (stationAction.dataset.stationAction === "copy-selected") {
      copySelectedSteps();
    }
    if (stationAction.dataset.stationAction === "paste-selected") {
      pasteCopiedSteps();
      return;
    }
    saveAndRender();
    return;
  }

  const jumpStep = event.target.closest("[data-jump-step]");
  if (jumpStep) {
    jumpToStep(jumpStep.dataset.jumpStation || stationNode.dataset.stationId, jumpStep.dataset.jumpStep);
    return;
  }

  const cellMenuValue = event.target.closest("[data-cell-menu-value]");
  if (cellMenuValue) {
    applyCellMenuValue(cellMenuValue.dataset.cellMenuValue);
    return;
  }

  const gridInsert = event.target.closest("[data-grid-insert]");
  if (gridInsert) {
    const menu = gridInsert.closest("[data-grid-context]");
    const count = Math.max(1, Number(menu?.querySelector("[data-grid-insert-count]")?.value) || 1);
    insertGridCells(gridInsert.dataset.gridInsert, count);
    return;
  }

  const gridAction = event.target.closest("[data-grid-action]");
  if (gridAction) {
    handleGridContextAction(gridAction.dataset.gridAction);
    return;
  }

  const cellEdge = event.target.closest("[data-cell-edge]");
  if (cellEdge) {
    if (edgeClickHandledByPointer) {
      edgeClickHandledByPointer = false;
      finishCellEdgeBrush();
      return;
    }
    toggleCellEdge(cellEdge);
    return;
  }

  const edgeAtPoint = getCellEdgeAtPointer(event, stationNode.dataset.stationId);
  if (edgeAtPoint) {
    if (edgeClickHandledByPointer) {
      edgeClickHandledByPointer = false;
      finishCellEdgeBrush();
      return;
    }
    toggleCellEdgeData(edgeAtPoint);
    return;
  }

  const conditionTool = event.target.closest("[data-condition-tool]");
  if (conditionTool) {
    const toolbar = conditionTool.closest("[data-condition-toolbar]");
    applyConditionTool(toolbar.dataset.stationId, toolbar.dataset.conditionToolbar, conditionTool.dataset.conditionTool);
    return;
  }

  const ladderElement = event.target.closest("[data-ladder-element]");
  if (ladderElement) {
    const type = ladderElement.dataset.ladderKind === "contact" ? "condition" : "ladder";
    selectComponent(type, ladderElement.dataset.stationId, ladderElement.dataset.stepId, ladderElement.dataset.ladderElement);
    activeConditionBox = { stationId: ladderElement.dataset.stationId, stepId: ladderElement.dataset.stepId };
    renderAll();
    return;
  }

  const ladderSlot = event.target.closest("[data-ladder-slot]");
  if (ladderSlot) {
    insertLadderToolAtSlot(ladderSlot);
    return;
  }

  const ladderCell = event.target.closest("[data-ladder-cell]");
  if (ladderCell) {
    handleLadderCellClick(ladderCell);
    return;
  }

  const insertSlot = event.target.closest("[data-insert-slot]");
  if (insertSlot) {
    insertConditionToolAtSlot(insertSlot);
    return;
  }

  const arrow = event.target.closest("[data-flow-arrow]");
  if (arrow) {
    clearConditionSelectionForArrow();
    activeInsert = { stationId: stationNode.dataset.stationId, index: Number(arrow.dataset.flowArrow) };
    renderAll();
    return;
  }

  const wireBranch = event.target.closest("[data-wire-branch]");
  if (wireBranch) {
    handleWireBranchButton(wireBranch);
    return;
  }

  const wire = event.target.closest("[data-wire-index]");
  if (wire) {
    if (isSelectedComponent("wire", wire.dataset.stationId, wire.dataset.stepId, wire.dataset.wireIndex)) {
      activateWireBranch(wire.dataset.stationId, wire.dataset.stepId, wire.dataset.wireIndex, event.shiftKey ? "down" : "up");
      return;
    }
    selectComponent("wire", wire.dataset.stationId, wire.dataset.stepId, wire.dataset.wireIndex);
    renderAll();
    return;
  }

  const waitToggle = event.target.closest("[data-toggle-wait]");
  if (waitToggle) {
    const card = waitToggle.closest(".action-card");
    const step = getStep(card.dataset.stationId, card.dataset.stepId);
    const action = step.actions.find((item) => item.id === waitToggle.dataset.toggleWait);
    if (!action) return;
    action.waitDone = action.waitDone === false;
    markDirty(card.dataset.stationId);
    saveAndRender();
    return;
  }

  const conditionBox = event.target.closest("[data-condition-box]");
  if (event.target.closest(".condition-point-select, .compare-controls")) return;
  const conditionChip = event.target.closest("[data-condition-id]");
  if (conditionChip) {
    selectComponent("condition", conditionChip.dataset.stationId, conditionChip.dataset.stepId, conditionChip.dataset.conditionId);
    activeConditionBox = { stationId: conditionChip.dataset.stationId, stepId: conditionChip.dataset.stepId };
    renderAll();
    return;
  }

  const branch = event.target.closest("[data-branch-index]");
  if (branch) {
    selectComponent("branch", branch.dataset.stationId, branch.dataset.stepId, `${branch.dataset.branchIndex}:${branch.dataset.branchLane}`);
    renderAll();
    return;
  }

  const actionCard = event.target.closest(".action-card");
  if (actionCard && !event.target.closest("select, input, .done-icon, .drag-handle")) {
    selectComponent("action", actionCard.dataset.stationId, actionCard.dataset.stepId, actionCard.dataset.actionId);
    renderAll();
    return;
  }

  if (conditionBox) {
    activeConditionBox = { stationId: stationNode.dataset.stationId, stepId: conditionBox.dataset.conditionBox };
    activeStep = { stationId: stationNode.dataset.stationId, stepId: conditionBox.dataset.conditionBox };
    selectedSteps = [conditionBox.dataset.conditionBox];
    const keepCell = selectedComponent?.type === "ladderCell" &&
      selectedComponent.stationId === stationNode.dataset.stationId &&
      selectedComponent.stepId === conditionBox.dataset.conditionBox;
    if (!keepCell) selectedComponent = null;
    activeInsert = null;
    if (!keepCell) activeCellMenu = null;
    renderAll();
    return;
  }

  const stepNode = event.target.closest(".flow-step");
  if (stepNode && !event.target.closest("button, select, input")) {
    if (suppressStepClick) {
      suppressStepClick = false;
      return;
    }
    const stepId = stepNode.dataset.stepId;
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      selectedSteps = selectedSteps.includes(stepId)
        ? selectedSteps.filter((id) => id !== stepId)
        : [...selectedSteps, stepId];
    } else {
      selectedSteps = [stepId];
    }
    activeStep = { stationId: stepNode.dataset.stationId, stepId };
    if (!getStep(stepNode.dataset.stationId, stepId)?.hasConditionBox) {
      activeConditionBox = null;
      selectedComponent = null;
    }
    activeInsert = null;
    renderAll();
  }
}

function closeFloatingEditorsForClick(event) {
  let closed = false;
  if (activeCellMenu && !isInsideActiveConditionEditor(event)) {
    activeCellMenu = null;
    closed = true;
  }
  return closed;
}

function isInsideActiveConditionEditor(event) {
  if (event.target.closest("[data-cell-menu], [data-ladder-cell], .condition-side-tools, [data-grid-context], .ladder-selected-editor")) {
    return true;
  }
  const conditionBox = event.target.closest("[data-condition-box]");
  return Boolean(conditionBox && activeCellMenu && conditionBox.dataset.conditionBox === activeCellMenu.stepId);
}

function hideConditionCellUi() {
  activeCellMenu = null;
  activeGridContext = null;
}

function clearConditionSelectionForArrow() {
  hideConditionCellUi();
  selectedComponent = null;
  selectedCells = [];
  activeConditionBox = null;
}

function handleStationDoubleClick(event) {
  const conditionChip = event.target.closest("[data-condition-id]");
  if (conditionChip) {
    toggleConditionContact(conditionChip.dataset.stationId, conditionChip.dataset.stepId, conditionChip.dataset.conditionId);
    saveAndRender();
    return;
  }

  const libraryItem = event.target.closest(".library-item");
  if (libraryItem) {
    if (canAutoFillConditionKind(libraryItem.dataset.kind) && autoFillConditionCell(libraryItem)) return;
    if (tryBindSelectedCondition(libraryItem)) return;
    insertPaletteItemByDoubleClick(libraryItem);
    return;
  }

  const canvas = event.target.closest(".flow-canvas");
  if (!canvas || event.target.closest(".flow-step, .flow-arrow, button, select, input")) return;
  const stationId = canvas.dataset.stationCanvas;
  const work = getWork(stationId);
  addArrow(stationId, work.steps.length);
  activeInsert = { stationId, index: work.steps.length };
  setActiveStation(stationId);
  saveAndRender();
}

function addConditionBoxFromToolbar(stationId) {
  const target = activeStep?.stationId === stationId ? getStep(stationId, activeStep.stepId) : null;
  if (target && !activeInsert && target.hasConditionBox) {
    activeConditionBox = { stationId, stepId: target.id };
    selectedSteps = [target.id];
    selectedComponent = null;
    setSummaryMessage("当前节点已有独立条件框，不能叠加。");
    return target;
  }
  const step = createStep({ hasConditionBox: true });
  setInsertAfterActiveStep(stationId);
  insertStepAtActivePosition(stationId, step);
  activeConditionBox = { stationId, stepId: step.id };
  selectedComponent = null;
  markDirty(stationId);
  return step;
}

function addActionStepFromToolbar(stationId) {
  const step = createStep();
  setInsertAfterActiveStep(stationId);
  insertStepAtActivePosition(stationId, step);
  activeConditionBox = null;
  selectedComponent = null;
  markDirty(stationId);
  return step;
}

function setInsertAfterActiveStep(stationId) {
  if (activeInsert?.stationId === stationId) return;
  if (activeStep?.stationId !== stationId) return;
  const work = getWork(stationId);
  const activeIndex = work.steps.findIndex((step) => step.id === activeStep.stepId);
  if (activeIndex >= 0) activeInsert = { stationId, index: activeIndex + 1 };
}

function insertStepAtActivePosition(stationId, step) {
  const work = getWork(stationId);
  let insertIndex = work.steps.length;
  if (activeInsert?.stationId === stationId && Number.isFinite(activeInsert.index)) {
    insertIndex = Math.max(0, Math.min(Number(activeInsert.index), work.steps.length));
  }
  work.arrows = work.arrows.map((index) => (index > insertIndex ? index + 1 : index));
  work.steps.splice(insertIndex, 0, step);
  ensureStepSystemNumbers(work);
  activeStep = { stationId, stepId: step.id };
  selectedSteps = [step.id];
  activeInsert = null;
  return step;
}

function handleStationContextMenu(event) {
  const cell = event.target.closest("[data-ladder-cell]");
  if (!cell) return;
  event.preventDefault();
  activeGridContext = {
    stationId: cell.dataset.stationId,
    stepId: cell.dataset.stepId,
    row: Number(cell.dataset.row),
    col: Number(cell.dataset.col),
    count: activeGridContext?.count || 1
  };
  selectedComponent = {
    type: "ladderCell",
    stationId: cell.dataset.stationId,
    stepId: cell.dataset.stepId,
    id: `${cell.dataset.row}:${cell.dataset.col}`
  };
  selectedCells = [{
    stationId: cell.dataset.stationId,
    stepId: cell.dataset.stepId,
    row: Number(cell.dataset.row),
    col: Number(cell.dataset.col)
  }];
  activeCellMenu = {
    stationId: cell.dataset.stationId,
    stepId: cell.dataset.stepId,
    row: Number(cell.dataset.row),
    col: Number(cell.dataset.col)
  };
  renderAll();
}

function handleStationChange(event) {
  const stepSystemNo = event.target.closest("[data-step-system-no]");
  if (stepSystemNo) {
    updateStepSystemNo(stepSystemNo);
    return;
  }

  const stepComment = event.target.closest("[data-step-comment]");
  if (stepComment) {
    updateStepComment(stepComment);
    return;
  }

  const coilTarget = event.target.closest("[data-coil-target]");
  if (coilTarget) {
    updateSelectedCoilTarget(coilTarget);
    return;
  }

  const libraryInput = event.target.closest("[data-library-edit-input]");
  if (libraryInput) {
    saveLibraryInput(libraryInput, { keepEditing: libraryInput.matches("[data-library-type-input]") });
    return;
  }

  const gridCount = event.target.closest("[data-grid-insert-count]");
  if (gridCount) {
    const context = activeGridContext || getSelectedGridContext();
    if (context) activeGridContext = { ...context, count: Math.max(1, Number(gridCount.value) || 1) };
    return;
  }

  const pointSelect = event.target.closest("[data-condition-point]");
  if (pointSelect) {
    updateConditionPoint(pointSelect);
    return;
  }

  const compareOp = event.target.closest("[data-compare-op]");
  if (compareOp) {
    updateConditionCompare(compareOp);
    return;
  }

  const compareValue = event.target.closest("[data-compare-value]");
  if (compareValue) {
    updateConditionCompare(compareValue);
    return;
  }

  const stationSwitch = event.target.closest("[data-station-select]");
  if (stationSwitch) {
    state.currentStationId = stationSwitch.value;
    state.programStationId = stationSwitch.value;
    activeStep = null;
    activeConditionBox = null;
    activeInsert = null;
    saveAndRender();
    return;
  }

  const zoneStationSwitch = event.target.closest("[data-zone-station-select]");
  if (zoneStationSwitch) {
    setZoneStation(zoneStationSwitch.dataset.zoneStationSelect, zoneStationSwitch.value);
    saveAndRender();
    return;
  }

  const select = event.target.closest("[data-select-action]");
  const duration = event.target.closest("[data-duration-action]");
  const field = select || duration;
  if (!field) return;
  const card = field.closest(".action-card");
  const step = getStep(card.dataset.stationId, card.dataset.stepId);
  const action = step.actions.find((item) => item.id === card.dataset.actionId);
  if (!action) return;

  if (select) {
    const option = action.options.find((item) => item.id === select.value);
    if (!option) return;
    action.actionId = option.id;
    action.actionLabel = option.label;
    action.command = option.command;
    action.done = option.done;
    action.alarm = `${action.deviceName}${option.label}超时`;
  } else {
    const nextDuration = Math.max(100, Number(duration.value) || 1000);
    action.durationMs = nextDuration;
    action.actionLabel = `${nextDuration} ms`;
    action.command = `Start_Timer(T_${nextDuration}, ${nextDuration})`;
    action.done = `T_${nextDuration}.Q`;
    action.timeoutMs = nextDuration + 1000;
  }
  markDirty(card.dataset.stationId);
  saveAndRender();
}

function handleStationFocusOut(event) {
  const stepSystemNo = event.target.closest("[data-step-system-no]");
  if (stepSystemNo) updateStepSystemNo(stepSystemNo);
  const stepComment = event.target.closest("[data-step-comment]");
  if (stepComment) updateStepComment(stepComment);
  const libraryInput = event.target.closest("[data-library-edit-input]");
  if (libraryInput && !libraryEditPointerDown) saveLibraryInput(libraryInput);
  const compareValue = event.target.closest("[data-compare-value]");
  if (compareValue) updateConditionCompare(compareValue);
}

function updateStepComment(input) {
  const step = getStep(input.dataset.stationId, input.dataset.stepComment);
  if (!step) return;
  step.comment = input.value;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function updateStepSystemNo(input) {
  const step = getStep(input.dataset.stationId, input.dataset.stepSystemNo);
  if (!step) return;
  const nextNo = Math.max(1, Number(input.value) || 1);
  step.systemNo = nextNo;
  markDirty(input.dataset.stationId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function updateSelectedCoilTarget(select) {
  const context = getSelectedGridContext();
  if (!context) return;
  const step = getStep(context.stationId, context.stepId);
  if (!step) return;
  const cell = findLadderCell(ensureLadderStep(step), context.row, context.col);
  if (!cell || cell.value !== "coil") return;
  cell.targetStepId = select.value || "";
  selectedSteps = cell.targetStepId ? [step.id, cell.targetStepId] : [step.id];
  markDirty(context.stationId);
  saveAndRender();
}

function applyLayoutVars() {
  state.layout = { ...createDefaultState().layout, ...(state.layout || {}) };
  state.layout.libraryWidth = clamp(Number(state.layout.libraryWidth) || 240, 190, 420);
  state.layout.codeWidth = clamp(Number(state.layout.codeWidth) || 360, 260, 720);
  document.documentElement.style.setProperty("--library-width", `${state.layout.libraryWidth}px`);
  document.documentElement.style.setProperty("--code-width", `${state.layout.codeWidth}px`);
}

function handlePaneResizePointerDown(event) {
  const handle = event.target.closest("[data-resizer]");
  if (!handle) return;
  event.preventDefault();
  const type = handle.dataset.resizer;
  state.layout = { ...createDefaultState().layout, ...(state.layout || {}) };
  const startX = event.clientX;
  const startLibrary = state.layout.libraryWidth;
  const startCode = state.layout.codeWidth;

  const onMove = (moveEvent) => {
    if (type === "station") {
      state.layout.libraryWidth = clamp(startLibrary + moveEvent.clientX - startX, 190, 420);
    }
    if (type === "workspace") {
      state.layout.codeWidth = clamp(startCode + startX - moveEvent.clientX, 260, 720);
    }
    applyLayoutVars();
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function insertPaletteItemByDoubleClick(node) {
  const sourceStationId = node.dataset.stationId;
  const stationId = getProgramStationId();
  const kind = node.dataset.kind;
  const item = findLibraryItem(sourceStationId, kind, node.dataset.id);
  if (!item) return;
  setActiveStation(stationId);

  if (kind === "actuator" || kind === "delay") {
    if (tryBindSelectedCondition(node)) return;
    const payload = { kind, item };
    if (activeInsert?.stationId === stationId) {
      const step = createStep();
      const work = getWork(stationId);
      const insertIndex = Math.max(0, Math.min(activeInsert.index, work.steps.length));
      work.arrows = work.arrows.map((index) => (index > insertIndex ? index + 1 : index));
      work.steps.splice(insertIndex, 0, step);
      addPayloadActionToStep(stationId, step.id, payload);
      activeInsert = null;
      saveAndRender();
      return;
    }

    const work = getWork(stationId);
    if (!activeStep || activeStep.stationId !== stationId || !getStep(stationId, activeStep.stepId)) {
      const step = createStep();
      work.steps.push(step);
      activeStep = { stationId, stepId: step.id };
    }
    addPayloadActionToStep(stationId, activeStep.stepId, payload);
    saveAndRender();
    return;
  }

  if (kind === "sensor" || kind === "system") {
    addConditionFromLibrary(stationId, item);
    saveAndRender();
    return;
  }

  if (kind === "local" || kind === "global") {
    addConditionFromLibrary(stationId, item);
    saveAndRender();
  }
}

function addConditionFromLibrary(stationId, item) {
  let step = null;
  if (activeConditionBox?.stationId === stationId) step = getStep(stationId, activeConditionBox.stepId);
  if (!step && activeStep?.stationId === stationId) {
    const selected = getStep(stationId, activeStep.stepId);
    if (selected?.hasConditionBox) step = selected;
  }
  if (!step) {
    step = createConditionStep(stationId, item);
    markDirty(stationId);
    return;
  }
  step.hasConditionBox = true;
  const nextCondition = createCondition(item);
  insertConditionAtActivePoint(stationId, step, nextCondition);
  activeConditionBox = { stationId, stepId: step.id };
  activeStep = { stationId, stepId: step.id };
  selectedComponent = { type: "condition", stationId, stepId: step.id, id: nextCondition.id };
  selectedSteps = [step.id];
  markDirty(stationId);
}

function canAutoFillConditionKind(kind) {
  return ["sensor", "system", "delay", "local", "global"].includes(kind);
}

function autoFillConditionCell(itemNode) {
  const sourceStationId = itemNode.dataset.stationId;
  const stationId = activeConditionBox?.stationId || activeStep?.stationId || getProgramStationId();
  const item = findLibraryItem(sourceStationId, itemNode.dataset.kind, itemNode.dataset.id);
  if (!item) return false;
  setActiveStation(stationId);
  let step = null;
  if (activeConditionBox?.stationId === stationId) step = getStep(stationId, activeConditionBox.stepId);
  if (!step && activeStep?.stationId === stationId) {
    const selected = getStep(stationId, activeStep.stepId);
    if (selected?.hasConditionBox) step = selected;
  }
  if (!step) {
    step = createStep({ hasConditionBox: true, ladder: createEmptyLadder() });
    getWork(stationId).steps.push(step);
  }
  const ladder = ensureLadderStep(step);
  const start = getSelectedCellPosition(stationId, step.id);
  const row = start?.row ?? LADDER_MAIN_ROW;
  let col = start?.col != null ? start.col : 0;
  while (col < ladder.cols) {
    const cell = ensureLadderCell(ladder, row, col);
    if (!cell.value || cell.value === "empty") break;
    col += 1;
  }
  if (col >= ladder.cols) ladder.cols = col + 2;
  const cell = ensureLadderCell(ladder, row, col);
  applySquareCellValue(cell, "NO");
  bindConditionToSource(cell, itemNode.dataset.kind, item);
  activeStep = { stationId, stepId: step.id };
  activeConditionBox = { stationId, stepId: step.id };
  selectedSteps = [step.id];
  selectedComponent = { type: "ladderCell", stationId, stepId: step.id, id: `${row}:${col}` };
  selectedCells = [{ stationId, stepId: step.id, row, col }];
  activeCellMenu = { stationId, stepId: step.id, row, col };
  markDirty(stationId);
  saveAndRender();
  return true;
}

function getSelectedCellPosition(stationId, stepId) {
  if (selectedComponent?.type !== "ladderCell" || selectedComponent.stationId !== stationId || selectedComponent.stepId !== stepId) return null;
  const [row, col] = selectedComponent.id.split(":").map(Number);
  if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
  return { row, col };
}

function loadVideoLogicDemo(stationId) {
  const work = getWork(stationId);
  const twoHand1 = findLibraryItem(stationId, "sensor", "twoHand1") || findLibraryItem(stationId, "system", "twoHand1");
  const demoMainRow = 1;

  const first = createConditionElement("NO");
  if (twoHand1) bindConditionToSource(first, "sensor", twoHand1);

  const middle = createConditionElement("NC");
  const right = createConditionElement("NC");

  const step = createStep({
    hasConditionBox: true,
    ladder: {
      rows: 4,
      cols: LADDER_DEFAULT_COLS,
      elements: [],
      cells: [
        { ...createLadderCell(demoMainRow, 0, "NO"), ...first, type: "square", value: "NO", contact: "NO" },
        createLadderCell(demoMainRow, 2, "wire"),
        { ...createLadderCell(demoMainRow, 3, "NC"), leftSegments: [true, true], rightSegments: [true, false] },
        createLadderCell(demoMainRow, 4, "wire"),
        createLadderCell(demoMainRow, 5, "NC"),
        createLadderCell(demoMainRow - 1, 0, "NO"),
        createLadderCell(demoMainRow - 1, 2, "NO"),
        { ...createLadderCell(demoMainRow - 1, 3, "NO"), leftSegments: [false, true], rightSegments: [false, true] },
        createLadderCell(demoMainRow + 1, 0, "NO"),
        { ...createLadderCell(demoMainRow + 1, 2, "wire"), rightSegments: [true, true] },
        createLadderCell(demoMainRow + 2, 0, "NO"),
        { ...createLadderCell(demoMainRow + 2, 2, "wire"), rightSegments: [true, false] }
      ]
    }
  });

  work.steps = [step];
  work.arrows = [];
  work.aiCompleted = false;
  work.aiSummary = [];
  work.codeEdited = false;
  work.codeOverride = "";

  setActiveStation(stationId);
  activeStep = { stationId, stepId: step.id };
  activeConditionBox = { stationId, stepId: step.id };
  activeInsert = null;
  selectedSteps = [step.id];
  selectedComponent = { type: "ladderCell", stationId, stepId: step.id, id: `${demoMainRow}:3` };
  activeConditionTool = "NO";
  markDirty(stationId);
  setSummaryMessage("已加载参考图条件结构：双手启动触点、上下分支、未绑定占位触点和可继续插入的位置。");
}

function createConditionStep(stationId, item) {
  const work = getWork(stationId);
  const condition = createCondition(item);
  const step = createStep({
    hasConditionBox: true,
    ladder: {
      rows: LADDER_DEFAULT_ROWS,
      cols: LADDER_DEFAULT_COLS,
      elements: [{ ...condition, row: LADDER_MAIN_ROW, col: 0 }]
    }
  });
  if (activeInsert?.stationId === stationId) {
    const insertIndex = Math.max(0, Math.min(activeInsert.index, work.steps.length));
    work.arrows = work.arrows.map((index) => (index > insertIndex ? index + 1 : index));
    work.steps.splice(insertIndex, 0, step);
    activeInsert = null;
  } else {
    work.steps.push(step);
  }
  activeConditionBox = { stationId, stepId: step.id };
  activeStep = { stationId, stepId: step.id };
  selectedComponent = { type: "condition", stationId, stepId: step.id, id: condition.id };
  selectedSteps = [step.id];
  return step;
}

function addCustomLibraryItem(stationId, kind) {
  const work = getWork(stationId);
  const collection = getMutableLibraryCollection(stationId, kind);
  const next = collection.length + 1;
  const defaults = createLibraryItemTemplate(kind, next);
  const item = {
    ...defaults,
    id: `${kind}_${uid("item")}`,
    name: defaults.name
  };
  if (kind === "actuator") {
    item.actions = buildDeviceActions(item.name, item.type, item.targets);
  }
  if (kind === "global") {
    item.address = `GVL.${item.name}`;
    item.expression = normalizeName(item.name);
  }
  if (kind === "local") {
    item.address = `#${item.name}`;
    item.expression = normalizeName(item.name);
  }
  collection.push(item);
  work.libraryOpen[kind] = true;
  editingLibraryItem = { stationId, kind, id: item.id, field: "name" };
}

function saveLibraryInput(input, options = {}) {
  if (!editingLibraryItem) return;
  const { stationId, kind, id } = editingLibraryItem;
  const value = input.value.trim();
  if (!value && ["name", "type", "targets"].includes(editingLibraryItem.field)) return;
  const savedField = editingLibraryItem.field;
  const direct = getMutableLibraryCollection(stationId, kind).find((candidate) => candidate.id === id);
  if (editingLibraryItem.field === "comment") {
    if (direct) {
      direct.comment = value;
      if (direct.address) direct.address = value;
    } else {
      const key = `${kind}:${id}`;
      if (kind === "global") state.globalComments[key] = value;
      else getWork(stationId).itemComments[key] = value;
    }
  } else if (editingLibraryItem.field === "type") {
    saveLibraryOverride(stationId, kind, id, "type", value, direct);
  } else if (editingLibraryItem.field === "targets") {
    saveLibraryOverride(stationId, kind, id, "targets", splitTargets(value), direct);
  } else {
    if (direct) {
      direct.name = value;
      direct.expression = direct.expression ? normalizeName(value) : direct.expression;
      if (kind === "actuator" && Array.isArray(direct.actions)) {
        direct.actions = buildDeviceActions(value, direct.type, direct.targets || getActionLabels(direct));
      }
    } else {
      const key = `${kind}:${id}`;
      if (kind === "global") {
        state.globalNames[key] = value;
      } else {
        getWork(stationId).itemNames[key] = value;
      }
    }
  }
  editingLibraryItem = options.keepEditing ? { stationId, kind, id, field: savedField } : null;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderCodePreview();
  renderAiSummary();
  updateCodeEditBadges();
  if (options.render === false) return;
  const itemNode = input.closest(".library-item");
  if (itemNode) {
    const nextNode = refreshLibraryItem(itemNode);
    if (options.keepEditing) {
      requestAnimationFrame(() => {
        focusWithoutScroll(getLibraryEditInput(nextNode, savedField));
      });
    }
  } else {
    renderAll();
  }
}

function beginLibraryInlineEdit(itemNode, field) {
  if (!itemNode) return;
  const activeInput = els.stationScroller.querySelector("[data-library-edit-input]");
  const sameItem = activeInput?.closest(".library-item") === itemNode;
  if (activeInput && editingLibraryItem) {
    saveLibraryInput(activeInput, { render: sameItem ? false : "local" });
  }
  editingLibraryItem = {
    stationId: itemNode.dataset.stationId,
    kind: itemNode.dataset.kind,
    id: itemNode.dataset.id,
    field
  };
  const nextNode = refreshLibraryItem(itemNode);
  requestAnimationFrame(() => {
    const input = getLibraryEditInput(nextNode, field);
    focusWithoutScroll(input);
    if (field !== "type") input?.select();
  });
}

function refreshLibraryItem(itemNode) {
  if (!itemNode) return null;
  const { stationId, kind, id } = itemNode.dataset;
  const item = findLibraryItem(stationId, kind, id);
  if (!item) return itemNode;
  const groups = itemNode.closest(".library-groups");
  const scrollTop = groups?.scrollTop || 0;
  const scrollLeft = groups?.scrollLeft || 0;
  itemNode.className = `library-item ${kind === "actuator" ? item.type : kind}`;
  const text = itemNode.querySelector(".library-item-text");
  if (text) text.innerHTML = renderLibraryItemText(stationId, kind, item);
  if (groups) {
    groups.scrollTop = scrollTop;
    groups.scrollLeft = scrollLeft;
  }
  return itemNode;
}

function getLibraryEditInput(itemNode, field) {
  if (!itemNode) return null;
  if (field === "name") return itemNode.querySelector("[data-library-name-input]");
  if (field === "comment") return itemNode.querySelector("[data-library-comment-input]");
  if (field === "type") return itemNode.querySelector("[data-library-type-input]");
  return itemNode.querySelector("[data-library-edit-input]");
}

function openTargetEditor(itemNode) {
  const stationId = itemNode.dataset.stationId;
  const kind = itemNode.dataset.kind;
  const id = itemNode.dataset.id;
  if (kind !== "actuator") return;
  const item = findLibraryItem(stationId, kind, id);
  if (!item) return;
  activeTargetEditor = { stationId, kind, id };
  els.targetModalTitle.textContent = `${item.name} - 目标编辑`;
  els.targetModalMeta.textContent = `${actuatorTypeLabel(item.type)} · ${getActionLabels(item).length} 个目标`;
  els.targetRows.innerHTML = getActionLabels(item).map((label, index) => renderTargetEditorRow(label, index)).join("");
  els.targetModal.hidden = false;
  requestAnimationFrame(() => {
    els.targetRows.querySelector("input")?.focus();
  });
}

function renderTargetEditorRow(label = "", index = 0) {
  return `
    <div class="target-row">
      <span>${index + 1}</span>
      <input data-target-label value="${escapeHtml(label)}" placeholder="目标名称，例如 P1安全位" />
      <button type="button" data-target-row-remove>删除</button>
    </div>
  `;
}

function addTargetEditorRow() {
  const index = els.targetRows.querySelectorAll(".target-row").length;
  els.targetRows.insertAdjacentHTML("beforeend", renderTargetEditorRow("", index));
  renumberTargetEditorRows();
  els.targetRows.querySelector(".target-row:last-child input")?.focus();
}

function renumberTargetEditorRows() {
  els.targetRows.querySelectorAll(".target-row").forEach((row, index) => {
    row.querySelector("span").textContent = String(index + 1);
  });
}

function closeTargetEditor() {
  activeTargetEditor = null;
  if (els.targetModal) els.targetModal.hidden = true;
}

function readTargetEditorLabels() {
  return Array.from(els.targetRows.querySelectorAll("[data-target-label]"))
    .map((input) => input.value.trim())
    .filter(Boolean);
}

function saveTargetEditor(downloadFile = false) {
  if (!activeTargetEditor) return;
  const { stationId, kind, id } = activeTargetEditor;
  const item = findLibraryItem(stationId, kind, id);
  if (!item) return;
  const targets = readTargetEditorLabels();
  if (!targets.length) {
    setSummaryMessage("至少保留 1 个执行器目标。");
    return;
  }
  const direct = getMutableLibraryCollection(stationId, kind).find((candidate) => candidate.id === id);
  saveLibraryOverride(stationId, kind, id, "targets", targets, direct);
  if (!direct) {
    const key = `${kind}:${id}`;
    getWork(stationId).itemTargets[key] = targets;
  }
  updateActionsForEditedTargets(stationId, id, targets);
  markDirty(stationId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (downloadFile) downloadLocalProjectFile();
  closeTargetEditor();
  renderAll();
}

function updateActionsForEditedTargets(stationId, deviceId, targets) {
  const item = findLibraryItem(stationId, "actuator", deviceId);
  if (!item) return;
  const nextOptions = buildDeviceActions(item.name, item.type, targets);
  getWork(stationId).steps.forEach((step) => {
    step.actions.forEach((action) => {
      if (action.deviceId !== deviceId) return;
      action.options = nextOptions.map((option) => ({ ...option }));
      if (!action.options.some((option) => option.id === action.actionId)) {
        const first = action.options[0];
        action.actionId = first.id;
        action.actionLabel = first.label;
        action.command = first.command;
        action.done = first.done;
      }
    });
  });
}

function canBindSelectedCondition(stationId) {
  if (!selectedComponent || selectedComponent.type !== "condition" || selectedComponent.stationId !== stationId) return false;
  const step = getStep(selectedComponent.stationId, selectedComponent.stepId);
  const condition = step ? findConditionById(step, selectedComponent.id) : null;
  return Boolean(condition && condition.kind !== "wire");
}

function tryBindSelectedCondition(itemNode) {
  const sourceStationId = itemNode.dataset.stationId;
  const stationId = selectedComponent?.stationId;
  if (!stationId) return false;
  if (selectedComponent?.type === "ladderCell" && selectedComponent.stationId === stationId) {
    const item = findLibraryItem(sourceStationId, itemNode.dataset.kind, itemNode.dataset.id);
    const step = getStep(stationId, selectedComponent.stepId);
    const position = getSelectedCellPosition(stationId, selectedComponent.stepId);
    if (!item || !step || !position) return false;
    const ladder = ensureLadderStep(step);
    const cell = ensureLadderCell(ladder, position.row, position.col);
    if (cell.type !== "square") return false;
    if (!["NO", "NC", "RISING", "FALLING"].includes(cell.value)) applySquareCellValue(cell, "NO");
    bindConditionToSource(cell, itemNode.dataset.kind, item);
    activeConditionBox = { stationId, stepId: step.id };
    selectedCells = [{ stationId, stepId: step.id, row: position.row, col: position.col }];
    activeCellMenu = { stationId, stepId: step.id, row: position.row, col: position.col };
    markDirty(stationId);
    saveAndRender();
    return true;
  }
  if (!canBindSelectedCondition(stationId)) return false;
  const item = findLibraryItem(sourceStationId, itemNode.dataset.kind, itemNode.dataset.id);
  if (!item) return false;
  const step = getStep(stationId, selectedComponent.stepId);
  const condition = findConditionById(step, selectedComponent.id);
  bindConditionToSource(condition, itemNode.dataset.kind, item);
  activeConditionBox = { stationId, stepId: step.id };
  markDirty(stationId);
  saveAndRender();
  return true;
}

function applyConditionTool(stationId, stepId, tool) {
  activeConditionTool = tool;
  const step = getStep(stationId, stepId);
  if (!step) return;
  step.hasConditionBox = true;
  activeStep = { stationId, stepId: step.id };
  activeConditionBox = { stationId, stepId: step.id };
  selectedSteps = [step.id];
  activeInsert = null;
  renderAll();
}

function handleLadderCellClick(cellNode) {
  const stationId = cellNode.dataset.stationId;
  const stepId = cellNode.dataset.stepId;
  const row = Number(cellNode.dataset.row);
  const col = Number(cellNode.dataset.col);
  const step = getStep(stationId, stepId);
  if (!step) return;
  const ladder = ensureLadderStep(step);
  const cell = ensureLadderCell(ladder, row, col);
  activeStep = { stationId, stepId };
  activeConditionBox = { stationId, stepId };
  selectedSteps = [stepId];
  selectedCells = [{ stationId, stepId, row, col }];
  selectedComponent = { type: "ladderCell", stationId, stepId, id: `${row}:${col}` };
  activeCellMenu = { stationId, stepId, row, col };
  renderAll();
}

function toggleCellEdge(edgeNode) {
  toggleCellEdgeData({
    stationId: edgeNode.dataset.stationId,
    stepId: edgeNode.dataset.stepId,
    row: Number(edgeNode.dataset.row),
    col: Number(edgeNode.dataset.col),
    side: edgeNode.dataset.cellEdge,
    segment: edgeNode.dataset.cellSegment || "top"
  });
}

function toggleCellEdgeData(edge) {
  const { stationId, stepId, row, col, side, segment } = edge;
  const step = getStep(stationId, stepId);
  if (!step) return;
  const ladder = ensureLadderStep(step);
  const cell = ensureLadderCell(ladder, row, col);
  const next = !getCellEdgeSegment(cell, side, segment);
  if (next && !canSetCellEdgeSegment(ladder, row, col, side, segment)) {
    setSummaryMessage("竖线两端需要连接横向实线或触点，不能悬空。");
    activeGridContext = null;
    activeCellMenu = { stationId, stepId, row, col };
    return;
  }
  setCellEdgeSegment(cell, side, segment, next);
  selectedComponent = { type: "ladderCell", stationId, stepId, id: `${row}:${col}` };
  selectedCells = [{ stationId, stepId, row, col }];
  activeStep = { stationId, stepId };
  activeConditionBox = { stationId, stepId };
  activeCellMenu = { stationId, stepId, row, col };
  markDirty(stationId);
  saveAndRender();
}

function canSetCellEdgeSegment(ladder, row, col, side, segment) {
  const targetRow = segment === "top" ? row - 1 : row + 1;
  if (targetRow < 0 || targetRow >= ladder.rows) return false;
  return hasHorizontalAtEdge(ladder, row, col, side) && hasHorizontalAtEdge(ladder, targetRow, col, side);
}

function hasHorizontalAtEdge(ladder, row, col, side) {
  const current = findLadderCell(ladder, row, col);
  const neighbor = findLadderCell(ladder, row, side === "left" ? col - 1 : col + 1);
  return hasHorizontalSignal(current) || hasHorizontalSignal(neighbor);
}

function hasHorizontalSignal(cell) {
  return Boolean(cell && ["NO", "NC", "RISING", "FALLING", "wire", "coil"].includes(cell.value));
}

function getCellEdgeAtPointer(event, stationId) {
  const svg = event.target.closest(".ladder-svg");
  if (!svg) return null;
  const stepId = svg.dataset.ladderSvg;
  if (!stepId) return null;
  const bounds = svg.getBoundingClientRect();
  const viewBox = svg.viewBox?.baseVal;
  const scaleX = viewBox?.width ? viewBox.width / bounds.width : 1;
  const scaleY = viewBox?.height ? viewBox.height / bounds.height : 1;
  const x = (event.clientX - bounds.left) * scaleX;
  const y = (event.clientY - bounds.top) * scaleY;
  const gridX = x - LADDER_LEFT_PAD;
  const gridY = y - LADDER_TOP_PAD;
  if (gridX < -10 || gridY < 0) return null;
  const row = Math.floor(gridY / LADDER_ROW_H);
  const col = Math.floor(gridX / LADDER_SQUARE_W);
  if (row < 0 || col < 0) return null;
  const localX = gridX - col * LADDER_SQUARE_W;
  const localY = gridY - row * LADDER_ROW_H;
  const threshold = 10;
  const side = localX <= threshold ? "left" : localX >= LADDER_SQUARE_W - threshold ? "right" : "";
  if (!side) return null;
  return {
    stationId,
    stepId,
    row,
    col,
    side,
    segment: localY < LADDER_ROW_H / 2 ? "top" : "bottom"
  };
}

function toggleCellEdgeLegacy(edgeNode) {
  const stationId = edgeNode.dataset.stationId;
  const stepId = edgeNode.dataset.stepId;
  const row = Number(edgeNode.dataset.row);
  const col = Number(edgeNode.dataset.col);
  const step = getStep(stationId, stepId);
  if (!step) return;
  const cell = ensureLadderCell(ensureLadderStep(step), row, col);
  const side = edgeNode.dataset.cellEdge;
  const segment = edgeNode.dataset.cellSegment || "top";
  setCellEdgeSegment(cell, side, segment, !getCellEdgeSegment(cell, side, segment));
  selectedComponent = { type: "ladderCell", stationId, stepId, id: `${row}:${col}` };
  activeStep = { stationId, stepId };
  activeConditionBox = { stationId, stepId };
  activeCellMenu = { stationId, stepId, row, col };
  markDirty(stationId);
  saveAndRender();
}

function startCellEdgeBrush(event, edgeNode) {
  event.preventDefault();
  event.stopPropagation();
  const stationId = edgeNode.dataset.stationId;
  const stepId = edgeNode.dataset.stepId;
  const row = Number(edgeNode.dataset.row);
  const col = Number(edgeNode.dataset.col);
  const step = getStep(stationId, stepId);
  if (!step) return;
  const ladder = ensureLadderStep(step);
  const cell = ensureLadderCell(ladder, row, col);
  const side = edgeNode.dataset.cellEdge;
  const segment = edgeNode.dataset.cellSegment || "top";
  const nextState = !getCellEdgeSegment(cell, side, segment);
  if (nextState && !canSetCellEdgeSegment(ladder, row, col, side, segment)) {
    setSummaryMessage("竖线两端需要连接横向实线或触点，不能悬空。");
    return;
  }
  edgeBrush = { stationId, stepId, state: nextState, touched: new Set() };
  paintCellEdgeSegment(edgeNode);
  edgeClickHandledByPointer = true;

  const onMove = (moveEvent) => {
    const next = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest("[data-cell-edge]");
    if (next) paintCellEdgeSegment(next);
  };
  const onUp = () => {
    finishCellEdgeBrush();
  };
  edgeBrush.cleanup = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}

function finishCellEdgeBrush() {
  const brush = edgeBrush;
  if (!brush) return;
  edgeBrush = null;
  brush.cleanup?.();
  markDirty(brush.stationId);
  saveAndRender();
}

function paintCellEdgeSegment(edgeNode) {
  if (!edgeBrush) return;
  const stationId = edgeNode.dataset.stationId;
  const stepId = edgeNode.dataset.stepId;
  if (stationId !== edgeBrush.stationId || stepId !== edgeBrush.stepId) return;
  const row = Number(edgeNode.dataset.row);
  const col = Number(edgeNode.dataset.col);
  const side = edgeNode.dataset.cellEdge;
  const segment = edgeNode.dataset.cellSegment || "top";
  const key = `${row}:${col}:${side}:${segment}`;
  if (edgeBrush.touched.has(key)) return;
  const step = getStep(stationId, stepId);
  if (!step) return;
  const ladder = ensureLadderStep(step);
  const cell = ensureLadderCell(ladder, row, col);
  if (edgeBrush.state && !canSetCellEdgeSegment(ladder, row, col, side, segment)) return;
  setCellEdgeSegment(cell, side, segment, edgeBrush.state);
  updateCellEdgeNode(edgeNode, edgeBrush.state);
  edgeBrush.touched.add(key);
  selectedComponent = { type: "ladderCell", stationId, stepId, id: `${row}:${col}` };
  activeStep = { stationId, stepId };
  activeConditionBox = { stationId, stepId };
  activeCellMenu = { stationId, stepId, row, col };
}

function updateCellEdgeNode(edgeNode, isOn) {
  const stationId = edgeNode.dataset.stationId;
  const stepId = edgeNode.dataset.stepId;
  const row = edgeNode.dataset.row;
  const col = edgeNode.dataset.col;
  const side = edgeNode.dataset.cellEdge;
  const segment = edgeNode.dataset.cellSegment || "top";
  const selector = `.cell-edge[data-station-id="${stationId}"][data-step-id="${stepId}"][data-row="${row}"][data-col="${col}"][data-cell-edge="${side}"][data-cell-segment="${segment}"]`;
  document.querySelector(selector)?.classList.toggle("is-on", Boolean(isOn));
}

function normalizeCellSegments(cell) {
  if (!Array.isArray(cell.leftSegments)) cell.leftSegments = cell.leftVertical ? [true, true] : [false, false];
  if (!Array.isArray(cell.rightSegments)) cell.rightSegments = cell.rightVertical ? [true, true] : [false, false];
  cell.leftSegments = [Boolean(cell.leftSegments[0]), Boolean(cell.leftSegments[1])];
  cell.rightSegments = [Boolean(cell.rightSegments[0]), Boolean(cell.rightSegments[1])];
}

function getCellEdgeSegment(cell, side, segment) {
  normalizeCellSegments(cell);
  const index = segment === "bottom" ? 1 : 0;
  return Boolean((side === "left" ? cell.leftSegments : cell.rightSegments)[index]);
}

function setCellEdgeSegment(cell, side, segment, value) {
  normalizeCellSegments(cell);
  const index = segment === "bottom" ? 1 : 0;
  const key = side === "left" ? "leftSegments" : "rightSegments";
  cell[key][index] = Boolean(value);
  cell[side === "left" ? "leftVertical" : "rightVertical"] = cell[key][0] && cell[key][1];
}

function applyCellMenuValue(value) {
  if (!activeCellMenu) return;
  const { stationId, stepId, row, col } = activeCellMenu;
  const step = getStep(stationId, stepId);
  if (!step) return;
  const ladder = ensureLadderStep(step);
  const cell = ensureLadderCell(ladder, row, col);
  const validation = validateLadderCellValue(ladder, row, col, value);
  if (!validation.ok) {
    setSummaryMessage(validation.message);
    selectedComponent = { type: "ladderCell", stationId, stepId, id: `${row}:${col}` };
    selectedCells = [{ stationId, stepId, row, col }];
    activeCellMenu = { stationId, stepId, row, col };
    return;
  }
  applySquareCellValue(cell, value);
  selectedComponent = { type: "ladderCell", stationId, stepId, id: `${row}:${col}` };
  selectedCells = [{ stationId, stepId, row, col }];
  activeCellMenu = { stationId, stepId, row, col };
  activeGridContext = activeGridContext?.stationId === stationId && activeGridContext?.stepId === stepId
    ? activeGridContext
    : null;
  markDirty(stationId);
  saveAndRender();
}

function validateLadderCellValue(ladder, row, col, value) {
  if (value === "empty") return { ok: true };
  const outputLike = value === "coil";
  if (outputLike) {
    if (!hasRowLogicBefore(ladder, row, col)) {
      return { ok: false, message: "线圈是输出端，左侧必须先有触点或横线逻辑。" };
    }
    if (hasSignalAfter(ladder, row, col)) {
      return { ok: false, message: "线圈只能放在分支最后，右侧不能再有触点、横线或线圈。" };
    }
    if (hasCoilBefore(ladder, row, col)) {
      return { ok: false, message: "同一分支不能串联多个线圈，请把第二个线圈放到并联支路末端。" };
    }
    return { ok: true };
  }
  if (hasCoilBefore(ladder, row, col)) {
    return { ok: false, message: "线圈右侧不能继续添加条件，触点和横线必须在线圈左侧。" };
  }
  return { ok: true };
}

function applySquareCellValue(cell, value) {
  cell.type = "square";
  cell.value = value;
  if (value === "empty" || value === "wire" || value === "coil") {
    cell.binding = null;
    cell.name = "";
    cell.address = "";
    cell.expression = "";
    cell.points = [];
    cell.pointId = "";
  }
  if (value !== "coil") cell.targetStepId = "";
  if (["NO", "NC", "RISING", "FALLING"].includes(value)) {
    cell.kind = "contact";
    cell.contact = value;
    if (!cell.binding) {
      cell.name = "?";
      cell.expression = "";
    }
  }
}

function insertGridCells(direction, count) {
  const context = activeGridContext || getSelectedGridContext();
  if (!context) return;
  const { stationId, stepId, row, col } = context;
  const step = getStep(stationId, stepId);
  if (!step) return;
  const ladder = ensureLadderStep(step);
  if (direction === "up" || direction === "down") {
    const insertAt = direction === "up" ? row : row + 1;
    ladder.cells.forEach((cell) => {
      if (cell.row >= insertAt) cell.row += count;
    });
    ladder.rows += count;
  } else {
    const groupWidth = count;
    const insertAt = direction === "left" ? col : col + 1;
    ladder.cells.forEach((cell) => {
      if (cell.col >= insertAt) cell.col += groupWidth;
    });
    ladder.cols += groupWidth;
  }
  activeGridContext = { stationId, stepId, row, col, count };
  activeCellMenu = { stationId, stepId, row, col };
  markDirty(stationId);
  saveAndRender();
}

function handleGridContextAction(action) {
  const context = activeGridContext || getSelectedGridContext();
  if (!context) return;
  const { stationId, stepId, row, col } = context;
  selectedComponent = { type: "ladderCell", stationId, stepId, id: `${row}:${col}` };
  selectedCells = [{ stationId, stepId, row, col }];
  if (action === "copy") {
    copySelectedCell();
    setSummaryMessage("已复制选中格子。");
  }
  if (action === "paste") pasteCopiedCell();
  if (action === "delete") {
    deleteSelectedCells();
    saveAndRender();
    return;
  }
  if (action === "delete-row") {
    deleteGridRow(stationId, stepId, row);
    return;
  }
  if (action === "delete-col") {
    deleteGridCol(stationId, stepId, col);
    return;
  }
  saveAndRender();
}

function deleteGridRow(stationId, stepId, row) {
  const step = getStep(stationId, stepId);
  if (!step) return;
  const ladder = ensureLadderStep(step);
  if (ladder.rows <= LADDER_DEFAULT_ROWS) {
    ladder.cells.forEach((cell) => {
      if (Number(cell.row) === row) clearLadderCell(cell);
    });
    setSummaryMessage(`至少保留 ${LADDER_DEFAULT_ROWS} 行，已清空当前行。`);
  } else {
    ladder.cells = ladder.cells
      .filter((cell) => Number(cell.row) !== row)
      .map((cell) => Number(cell.row) > row ? { ...cell, row: Number(cell.row) - 1 } : cell);
    ladder.rows = Math.max(LADDER_DEFAULT_ROWS, ladder.rows - 1);
  }
  selectedCells = [];
  selectedComponent = null;
  hideConditionCellUi();
  markDirty(stationId);
  saveAndRender();
}

function deleteGridCol(stationId, stepId, col) {
  const step = getStep(stationId, stepId);
  if (!step) return;
  const ladder = ensureLadderStep(step);
  if (ladder.cols <= LADDER_DEFAULT_COLS) {
    ladder.cells.forEach((cell) => {
      if (Number(cell.col) === col) clearLadderCell(cell);
    });
    setSummaryMessage(`至少保留 ${LADDER_DEFAULT_COLS} 列，已清空当前列。`);
  } else {
    ladder.cells = ladder.cells
      .filter((cell) => Number(cell.col) !== col)
      .map((cell) => Number(cell.col) > col ? { ...cell, col: Number(cell.col) - 1 } : cell);
    ladder.cols = Math.max(LADDER_DEFAULT_COLS, ladder.cols - 1);
  }
  selectedCells = [];
  selectedComponent = null;
  hideConditionCellUi();
  markDirty(stationId);
  saveAndRender();
}

function getSelectedGridContext() {
  if (selectedComponent?.type !== "ladderCell") return null;
  const position = getSelectedCellPosition(selectedComponent.stationId, selectedComponent.stepId);
  if (!position) return null;
  return {
    stationId: selectedComponent.stationId,
    stepId: selectedComponent.stepId,
    row: position.row,
    col: position.col,
    count: activeGridContext?.count || 1
  };
}

function copySelectedCell() {
  const cells = getSelectedCellRefs();
  if (!cells.length) return false;
  const minRow = Math.min(...cells.map((cell) => cell.row));
  const minCol = Math.min(...cells.map((cell) => cell.col));
  copiedCells = cells.map((ref) => {
    const step = getStep(ref.stationId, ref.stepId);
    const cell = step ? ensureLadderCell(ensureLadderStep(step), ref.row, ref.col) : null;
    return cell ? { ...cloneStep(cell), rowOffset: ref.row - minRow, colOffset: ref.col - minCol } : null;
  }).filter(Boolean);
  return true;
}

function pasteCopiedCell() {
  if (!copiedCells.length || selectedComponent?.type !== "ladderCell") return false;
  const step = getStep(selectedComponent.stationId, selectedComponent.stepId);
  const position = getSelectedCellPosition(selectedComponent.stationId, selectedComponent.stepId);
  if (!step || !position) return false;
  const ladder = ensureLadderStep(step);
  copiedCells.forEach((source) => {
    const row = position.row + (Number(source.rowOffset) || 0);
    const col = position.col + (Number(source.colOffset) || 0);
    const target = ensureLadderCell(ladder, row, col);
    Object.assign(target, cloneStep(source), {
      id: target.id,
      row: target.row,
      col: target.col,
      type: "square"
    });
  });
  ladder.rows = Math.max(ladder.rows, position.row + Math.max(...copiedCells.map((cell) => Number(cell.rowOffset) || 0)) + 1);
  ladder.cols = Math.max(ladder.cols, position.col + Math.max(...copiedCells.map((cell) => Number(cell.colOffset) || 0)) + 1);
  markDirty(selectedComponent.stationId);
  saveAndRender();
  return true;
}

function getSelectedCellRefs() {
  if (selectedCells.length) return selectedCells;
  if (selectedComponent?.type !== "ladderCell") return [];
  const position = getSelectedCellPosition(selectedComponent.stationId, selectedComponent.stepId);
  if (!position) return [];
  return [{ stationId: selectedComponent.stationId, stepId: selectedComponent.stepId, row: position.row, col: position.col }];
}

function deleteSelectedCells() {
  const cells = getSelectedCellRefs();
  if (!cells.length) return false;
  cells.forEach((ref) => {
    const step = getStep(ref.stationId, ref.stepId);
    if (!step) return;
    clearLadderCell(ensureLadderCell(ensureLadderStep(step), ref.row, ref.col));
    markDirty(ref.stationId);
  });
  selectedCells = [];
  selectedComponent = null;
  activeCellMenu = null;
  activeGridContext = null;
  return true;
}

function insertConditionToolAtSlot(slot) {
  const stationId = slot.dataset.stationId;
  const stepId = slot.dataset.stepId;
  const step = getStep(stationId, stepId);
  if (!step) return;
  const lane = slot.dataset.insertLane;
  const index = Number(slot.dataset.insertSlot);
  activeInsert = { stationId, stepId, lane, index };
  if (activeConditionTool === "up" || activeConditionTool === "down") {
    insertBranchAtSlot(stationId, step, lane, index, activeConditionTool);
  } else {
    const element = activeConditionTool === "wire" ? createWireElement() : createConditionElement(activeConditionTool);
    insertElementAtSlot(step, lane, index, element);
    selectedComponent = { type: "condition", stationId, stepId: step.id, id: element.id };
  }
  activeStep = { stationId, stepId: step.id };
  activeConditionBox = { stationId, stepId: step.id };
  selectedSteps = [step.id];
  markDirty(stationId);
  saveAndRender();
}

function insertLadderToolAtSlot(slot) {
  const stationId = slot.dataset.stationId;
  const stepId = slot.dataset.stepId;
  const step = getStep(stationId, stepId);
  if (!step) return;
  const ladder = ensureLadderStep(step);
  const row = Number(slot.dataset.row);
  const col = Number(slot.dataset.col);
  activeInsert = { stationId, stepId, row, col };
  const existing = findLadderElementAt(ladder, row, col);
  if (existing) {
    const type = existing.kind === "contact" ? "condition" : "ladder";
    selectComponent(type, stationId, stepId, existing.id);
    renderAll();
    return;
  }
  const kind = activeConditionTool === "wire"
    ? "wire"
    : activeConditionTool === "up" || activeConditionTool === "down"
      ? "vwire"
      : "contact";
  const element = createLadderElement(kind, row, col);
  ladder.elements.push(element);
  ladder.rows = Math.max(ladder.rows, row + 1);
  ladder.cols = Math.max(ladder.cols, col + 2);
  const selectedType = element.kind === "contact" ? "condition" : "ladder";
  selectedComponent = { type: selectedType, stationId, stepId, id: element.id };
  activeStep = { stationId, stepId };
  activeConditionBox = { stationId, stepId };
  selectedSteps = [stepId];
  markDirty(stationId);
  saveAndRender();
}

function insertElementAtSlot(step, lane, index, element) {
  normalizeBranches(step);
  if (lane === "main") {
    step.conditions.splice(Math.max(0, Math.min(index, step.conditions.length)), 0, element);
    return;
  }
  const [branchIndex, branchLane] = lane.split(":");
  const branch = ensureBranchLane(step, branchIndex, branchLane);
  branch.splice(Math.max(0, Math.min(index, branch.length)), 0, element);
}

function insertBranchAtSlot(stationId, step, lane, index, branchLane) {
  if (lane !== "main") {
    const [branchIndex] = lane.split(":");
    ensureBranchLane(step, branchIndex, branchLane);
    selectedComponent = { type: "branch", stationId, stepId: step.id, id: `${branchIndex}:${branchLane}` };
    return;
  }
  if (step.conditions.length < 2) {
    while (step.conditions.length < 2) step.conditions.push(createWireElement());
  }
  const branchIndex = Math.max(0, Math.min(index, step.conditions.length - 2));
  ensureBranchLane(step, branchIndex, branchLane);
  selectedComponent = { type: "branch", stationId, stepId: step.id, id: `${branchIndex}:${branchLane}` };
}

function ensureBranchForTool(stationId, step, lane) {
  if (step.conditions.length < 2) {
    step.conditions.push(createWireElement(), createWireElement());
  }
  let branchIndex = 0;
  if (selectedComponent?.stationId === stationId && selectedComponent?.stepId === step.id) {
    if (selectedComponent.type === "wire") {
      branchIndex = Math.min(Number(selectedComponent.id) || 0, Math.max(0, step.conditions.length - 2));
    }
    if (selectedComponent.type === "condition") {
      const location = findConditionLocation(step, selectedComponent.id);
      if (location?.type === "main") branchIndex = Math.min(location.index, Math.max(0, step.conditions.length - 2));
      if (location?.type === "branch") branchIndex = Math.min(Number(location.branchIndex) || 0, Math.max(0, step.conditions.length - 2));
    }
    if (selectedComponent.type === "branch") {
      branchIndex = Math.min(Number(selectedComponent.id.split(":")[0]) || 0, Math.max(0, step.conditions.length - 2));
    }
  }
  ensureBranchLane(step, branchIndex, lane);
  selectedComponent = { type: "branch", stationId, stepId: step.id, id: `${branchIndex}:${lane}` };
}

function updateConditionPoint(select) {
  const chip = select.closest("[data-condition-id]");
  const step = getStep(chip.dataset.stationId, chip.dataset.stepId);
  const condition = findConditionById(step, chip.dataset.conditionId);
  if (!condition) return;
  applyConditionPoint(condition, select.value);
  markDirty(chip.dataset.stationId);
  saveAndRender();
}

function updateConditionCompare(field) {
  const chip = field.closest("[data-condition-id]");
  const step = getStep(chip.dataset.stationId, chip.dataset.stepId);
  const condition = findConditionById(step, chip.dataset.conditionId);
  if (!condition) return;
  const op = chip.querySelector("[data-compare-op]");
  const value = chip.querySelector("[data-compare-value]");
  condition.compareOp = op?.value || condition.compareOp;
  condition.compareValue = value?.value ?? condition.compareValue;
  condition.expression = conditionExpression(condition);
  markDirty(chip.dataset.stationId);
  saveAndRender();
}

function deleteSelectedSteps(stationId = state.currentStationId) {
  const work = getWork(stationId);
  const ids = selectedSteps.length ? selectedSteps : activeStep?.stationId === stationId ? [activeStep.stepId] : [];
  if (!ids.length) return;
  work.steps = work.steps.filter((step) => !ids.includes(step.id));
  work.arrows = work.arrows
    .filter((arrowIndex) => arrowIndex <= work.steps.length);
  activeStep = null;
  activeConditionBox = null;
  activeInsert = null;
  selectedSteps = [];
  markDirty(stationId);
}

function deleteSelectedComponent() {
  if (selectedCells.length) return deleteSelectedCells();
  if (!selectedComponent) return false;
  const stationId = selectedComponent.stationId;
  const step = getStep(selectedComponent.stationId, selectedComponent.stepId);
  if (!step) return false;
  if (selectedComponent.type === "ladderCell") {
    const [row, col] = selectedComponent.id.split(":").map(Number);
    const ladder = ensureLadderStep(step);
    const cell = ensureLadderCell(ladder, row, col);
    clearLadderCell(cell);
  }
  if (selectedComponent.type === "action") {
    step.actions = step.actions.filter((action) => action.id !== selectedComponent.id);
  }
  if (selectedComponent.type === "condition") {
    removeConditionById(step, selectedComponent.id);
  }
  if (selectedComponent.type === "ladder") {
    removeLadderElementById(step, selectedComponent.id);
  }
  if (selectedComponent.type === "wire" || selectedComponent.type === "branch") {
    const branchId = selectedComponent.type === "branch" ? selectedComponent.id.split(":")[0] : selectedComponent.id;
    if (step.branches) delete step.branches[branchId];
  }
  selectedComponent = null;
  activeCellMenu = null;
  markDirty(stationId);
  return true;
}

function clearLadderCell(cell) {
  cell.value = "empty";
  cell.binding = null;
  cell.name = "";
  cell.address = "";
  cell.expression = "";
  cell.pointId = "";
  cell.pointLabel = "";
  cell.points = [];
  cell.targetStepId = "";
  cell.leftSegments = [false, false];
  cell.rightSegments = [false, false];
  cell.leftVertical = false;
  cell.rightVertical = false;
}

function selectComponent(type, stationId, stepId, id) {
  selectedComponent = { type, stationId, stepId, id: String(id) };
  activeStep = { stationId, stepId };
  selectedSteps = [stepId];
  activeConditionBox = ["condition", "wire", "branch", "ladder"].includes(type) ? { stationId, stepId } : activeConditionBox;
  if (type !== "ladderCell") {
    selectedCells = [];
    hideConditionCellUi();
  }
}

function isSelectedComponent(type, stationId, stepId, id) {
  return selectedComponent?.type === type &&
    selectedComponent.stationId === stationId &&
    selectedComponent.stepId === stepId &&
    selectedComponent.id === String(id);
}

function insertConditionAtActivePoint(stationId, step, condition) {
  if (step.hasConditionBox) {
    const ladder = ensureLadderStep(step);
    let row = LADDER_MAIN_ROW;
    let col = getNextLadderCol(ladder, row);
    if (activeInsert?.stationId === stationId && activeInsert?.stepId === step.id && Number.isFinite(activeInsert.row) && Number.isFinite(activeInsert.col)) {
      row = activeInsert.row;
      col = activeInsert.col;
    } else if (selectedComponent?.stationId === stationId && selectedComponent?.stepId === step.id) {
      const selected = ladder.elements.find((element) => element.id === selectedComponent.id);
      if (selected) {
        row = selected.row;
        col = selected.col + 1;
      }
    }
    ladder.elements = ladder.elements.filter((element) => !(element.row === row && element.col === col));
    ladder.elements.push({ ...condition, row, col });
    ladder.rows = Math.max(ladder.rows, row + 1);
    ladder.cols = Math.max(ladder.cols, col + 2);
    return;
  }
  normalizeBranches(step);
  if (selectedComponent?.stationId === stationId && selectedComponent?.stepId === step.id) {
    if (selectedComponent.type === "branch") {
      const [branchIndex, lane] = selectedComponent.id.split(":");
      const branch = ensureBranchLane(step, branchIndex, lane);
      branch.push(condition);
      return;
    }
    if (selectedComponent.type === "condition") {
      const location = findConditionLocation(step, selectedComponent.id);
      if (location?.type === "branch") {
        location.conditions.splice(location.index + 1, 0, condition);
        return;
      }
    }
  }
  const insertIndex = getConditionInsertIndex(stationId, step);
  step.conditions.splice(insertIndex, 0, condition);
}

function getNextLadderCol(ladder, row = LADDER_MAIN_ROW) {
  const used = ladder.elements
    .filter((element) => element.row === row)
    .map((element) => Number(element.col) || 0);
  return used.length ? Math.max(...used) + 1 : 0;
}

function getConditionInsertIndex(stationId, step) {
  if (selectedComponent?.stationId !== stationId || selectedComponent?.stepId !== step.id) return step.conditions.length;
  if (selectedComponent.type === "wire") return Math.min(Number(selectedComponent.id) + 1, step.conditions.length);
  if (selectedComponent.type === "condition") {
    const location = findConditionLocation(step, selectedComponent.id);
    if (location?.type === "main") return location.index + 1;
  }
  return step.conditions.length;
}

function normalizeBranches(step) {
  if (!step.branches) step.branches = {};
  Object.entries(step.branches).forEach(([index, branch]) => {
    if (!branch || typeof branch !== "object") {
      step.branches[index] = {};
      return;
    }
    ["up", "down"].forEach((lane) => {
      if (branch[lane] === true) branch[lane] = [];
      if (branch[lane] === false || branch[lane] == null) delete branch[lane];
      if (branch[lane] && !Array.isArray(branch[lane])) branch[lane] = [];
      if (Array.isArray(branch[lane])) branch[lane] = branch[lane].map(normalizeConditionElement);
    });
  });
}

function ensureLadderStep(step) {
  if (!step.hasConditionBox) return null;
  if (!step.ladder || (!Array.isArray(step.ladder.elements) && !Array.isArray(step.ladder.cells))) {
    step.ladder = migrateLegacyLadder(step);
  }
  if (!Array.isArray(step.ladder.elements)) step.ladder.elements = [];
  if (!Array.isArray(step.ladder.cells)) step.ladder.cells = migrateElementsToCells(step.ladder.elements);
  step.ladder.rows = Math.max(LADDER_DEFAULT_ROWS, Number(step.ladder.rows) || LADDER_DEFAULT_ROWS);
  step.ladder.cols = Math.max(LADDER_DEFAULT_COLS, Number(step.ladder.cols) || LADDER_DEFAULT_COLS);
  step.ladder.elements = step.ladder.elements.map(normalizeLadderElement).filter(Boolean);
  step.ladder.cells = step.ladder.cells.map(normalizeLadderCell).filter(Boolean);
  if (!step.ladder.cells.some(isUsedLadderCell)) {
    step.ladder.rows = LADDER_MIN_ROWS;
    step.ladder.cols = LADDER_MIN_COLS;
  }
  step.ladder.rows = Math.max(step.ladder.rows, getUsedLadderRows(step.ladder));
  step.ladder.cols = Math.max(step.ladder.cols, getUsedLadderCols(step.ladder));
  return step.ladder;
}

function migrateElementsToCells(elements = []) {
  return elements.map((element) => {
    const col = Math.max(0, Number(element.col) || 0);
    const cell = createLadderCell(Number(element.row) || 0, col, element.kind === "wire" ? "wire" : element.contact || "NO");
  if (element.kind === "vwire") {
    cell.value = "empty";
    cell.rightVertical = true;
    cell.rightSegments = [true, true];
  }
    if (element.kind !== "wire" && element.kind !== "vwire") {
      Object.assign(cell, normalizeConditionElement({ ...element, kind: "contact" }));
      cell.value = element.contact || "NO";
      cell.type = "square";
    }
    return cell;
  });
}

function normalizeLadderCell(cell) {
  if (!cell || typeof cell !== "object") return null;
  const normalized = { ...cell };
  normalized.row = Math.max(0, Number(normalized.row) || 0);
  normalized.col = Math.max(0, Number(normalized.col) || 0);
  normalized.type = "square";
  if (!normalized.id) normalized.id = uid("cell");
  if (!normalized.value) normalized.value = "empty";
  normalizeCellSegments(normalized);
  if (["NO", "NC", "RISING", "FALLING"].includes(normalized.value)) {
    normalized.kind = "contact";
    normalized.contact = normalized.value;
    return normalizeConditionElement(normalized);
  }
  return normalized;
}

function migrateLegacyLadder(step) {
  const ladder = createEmptyLadder();
  const main = Array.isArray(step.conditions) ? step.conditions : [];
  main.forEach((condition, index) => {
    ladder.elements.push({
      ...normalizeConditionElement(condition),
      row: LADDER_MAIN_ROW,
      col: index
    });
  });
  normalizeBranches(step);
  Object.entries(step.branches || {}).forEach(([branchIndex, branch]) => {
    const baseCol = Math.max(0, Number(branchIndex) || 0);
    ["up", "down"].forEach((lane) => {
      const row = lane === "up" ? LADDER_MAIN_ROW - 1 : LADDER_MAIN_ROW + 1;
      if (!hasBranchLane(branch, lane)) return;
      ladder.elements.push({
        ...createVerticalWireElement(lane),
        row: LADDER_MAIN_ROW,
        col: baseCol,
        direction: lane
      });
      getBranchConditions(branch, lane).forEach((condition, offset) => {
        ladder.elements.push({
          ...normalizeConditionElement(condition),
          row,
          col: baseCol + offset + 1
        });
      });
    });
  });
  return ladder;
}

function normalizeLadderElement(element) {
  if (!element || typeof element !== "object") return null;
  const normalized = { ...element };
  normalized.row = Math.max(0, Number(normalized.row) || 0);
  normalized.col = Math.max(0, Number(normalized.col) || 0);
  if (normalized.kind === "wire" || normalized.kind === "vwire") {
    if (!normalized.id) normalized.id = uid(normalized.kind === "vwire" ? "vwire" : "wire");
    if (normalized.kind === "vwire" && !normalized.direction) normalized.direction = "down";
    return normalized;
  }
  normalized.kind = "contact";
  return normalizeConditionElement(normalized);
}

function normalizeConditionElement(condition) {
  if (condition.kind === "wire") return condition;
  if (condition.kind === "vwire") return condition;
  if (!condition.kind) condition.kind = "contact";
  if (!condition.contact) condition.contact = "NO";
  if (!condition.name) condition.name = condition.binding ? condition.binding.name : "?";
  if (!Array.isArray(condition.points)) {
    condition.points = condition.expression ? [{
      id: "value",
      label: condition.address || "信号",
      expression: condition.expression,
      address: condition.address || "",
      valueType: condition.valueType || "BOOL",
      isDefault: true
    }] : [];
  }
  if (!condition.binding && condition.sourceId) {
    condition.binding = {
      kind: condition.sourceKind || "sensor",
      id: condition.sourceId,
      name: condition.name
    };
  }
  if (!condition.pointId && condition.points[0]) condition.pointId = condition.points[0].id;
  if (!condition.pointLabel && condition.points[0]) condition.pointLabel = condition.points[0].label;
  if (!condition.valueType) condition.valueType = condition.points[0]?.valueType || "BOOL";
  if (typeof condition.compareOp === "undefined") condition.compareOp = defaultCompareOp(condition.valueType);
  if (typeof condition.compareValue === "undefined") condition.compareValue = defaultCompareValue(condition.valueType);
  if (condition.binding) condition.expression = conditionExpression(condition);
  return condition;
}

function hasBranchLane(branch, lane) {
  if (!branch) return false;
  return branch[lane] === true || Array.isArray(branch[lane]);
}

function getBranchConditions(branch, lane) {
  if (!branch) return [];
  if (branch[lane] === true) {
    branch[lane] = [];
    return branch[lane];
  }
  if (!Array.isArray(branch[lane])) return [];
  return branch[lane];
}

function ensureBranchLane(step, index, lane) {
  if (!step.branches) step.branches = {};
  if (!step.branches[index]) step.branches[index] = {};
  if (!Array.isArray(step.branches[index][lane])) step.branches[index][lane] = [];
  return step.branches[index][lane];
}

function findConditionById(step, conditionId) {
  return findConditionLocation(step, conditionId)?.condition || null;
}

function findConditionLocation(step, conditionId) {
  if (step?.ladder?.cells) {
    const cellIndex = step.ladder.cells.findIndex((cell) => cell.id === conditionId);
    if (cellIndex >= 0) {
      return {
        type: "ladderCell",
        index: cellIndex,
        condition: step.ladder.cells[cellIndex],
        conditions: step.ladder.cells
      };
    }
  }
  if (step?.ladder?.elements) {
    const ladderIndex = step.ladder.elements.findIndex((condition) => condition.id === conditionId);
    if (ladderIndex >= 0) {
      return {
        type: "ladder",
        index: ladderIndex,
        condition: step.ladder.elements[ladderIndex],
        conditions: step.ladder.elements
      };
    }
  }
  const mainIndex = step.conditions.findIndex((condition) => condition.id === conditionId);
  if (mainIndex >= 0) {
    return { type: "main", index: mainIndex, condition: step.conditions[mainIndex], conditions: step.conditions };
  }
  normalizeBranches(step);
  for (const [branchIndex, branch] of Object.entries(step.branches || {})) {
    for (const lane of ["up", "down"]) {
      const conditions = getBranchConditions(branch, lane);
      const index = conditions.findIndex((condition) => condition.id === conditionId);
      if (index >= 0) {
        return { type: "branch", branchIndex, lane, index, condition: conditions[index], conditions };
      }
    }
  }
  return null;
}

function removeConditionById(step, conditionId) {
  const location = findConditionLocation(step, conditionId);
  if (!location) return;
  location.conditions.splice(location.index, 1);
}

function removeLadderElementById(step, elementId) {
  if (!step.ladder?.elements) return;
  step.ladder.elements = step.ladder.elements.filter((element) => element.id !== elementId);
}

function toggleConditionContact(stationId, stepId, conditionId) {
  const step = getStep(stationId, stepId);
  const condition = step ? findConditionById(step, conditionId) : null;
  if (!condition) return;
  condition.contact = condition.contact === "NC" ? "NO" : "NC";
  selectComponent("condition", stationId, stepId, conditionId);
  markDirty(stationId);
}

function toggleWireBranch(stationId, stepId, index, key) {
  activateWireBranch(stationId, stepId, index, key, true);
}

function activateWireBranch(stationId, stepId, index, key, allowRemove = false) {
  const step = getStep(stationId, stepId);
  if (!step) return;
  if (!step.branches) step.branches = {};
  step.branches[index] = step.branches[index] || {};
  const lane = getBranchConditions(step.branches[index], key);
  if (allowRemove && lane.length === 0 && hasBranchLane(step.branches[index], key)) {
    delete step.branches[index][key];
  } else {
    step.branches[index][key] = lane;
  }
  selectComponent("branch", stationId, stepId, `${index}:${key}`);
  markDirty(stationId);
  saveAndRender();
}

function handleWireBranchButton(button) {
  const wire = button.closest("[data-wire-index]");
  toggleWireBranch(wire.dataset.stationId, wire.dataset.stepId, wire.dataset.wireIndex, button.dataset.wireBranch);
}

function copySelectedSteps() {
  const stationId = activeStep?.stationId || getProgramStationId();
  const work = getWork(stationId);
  const ids = selectedSteps.length ? selectedSteps : activeStep ? [activeStep.stepId] : [];
  copiedSteps = work.steps
    .filter((step) => ids.includes(step.id))
    .map((step) => cloneStep(step));
}

function pasteCopiedSteps() {
  if (!copiedSteps.length) return;
  const stationId = activeStep?.stationId || getProgramStationId();
  const work = getWork(stationId);
  let insertIndex = work.steps.length;
  if (activeStep?.stationId === stationId) {
    const activeIndex = work.steps.findIndex((step) => step.id === activeStep.stepId);
    if (activeIndex >= 0) insertIndex = activeIndex + 1;
  }
  const clones = copiedSteps.map((step) => rehydrateStepIds(cloneStep(step)));
  work.steps.splice(insertIndex, 0, ...clones);
  selectedSteps = clones.map((step) => step.id);
  activeStep = { stationId, stepId: clones[clones.length - 1].id };
  activeConditionBox = clones[clones.length - 1].hasConditionBox
    ? { stationId, stepId: clones[clones.length - 1].id }
    : null;
  markDirty(stationId);
  saveAndRender();
}

function cloneStep(step) {
  return JSON.parse(JSON.stringify(step));
}

function rehydrateStepIds(step) {
  step.id = uid("step");
  step.conditions = (step.conditions || []).map((condition) => ({ ...condition, id: uid(condition.kind === "wire" ? "wire" : "cond") }));
  if (step.ladder?.elements) {
    step.ladder.elements = step.ladder.elements.map((element) => ({
      ...element,
      id: uid(element.kind === "vwire" ? "vwire" : element.kind === "wire" ? "wire" : "cond")
    }));
  }
  Object.values(step.branches || {}).forEach((branch) => {
    ["up", "down"].forEach((lane) => {
      if (Array.isArray(branch[lane])) {
        branch[lane] = branch[lane].map((condition) => ({ ...condition, id: uid(condition.kind === "wire" ? "wire" : "cond") }));
      }
    });
  });
  step.actions = (step.actions || []).map((action) => ({ ...action, id: uid("act") }));
  step.ai = null;
  return step;
}

function startMarqueeSelect(event, canvas) {
  if (event.button !== 0) return;
  const startX = event.clientX;
  const startY = event.clientY;
  let moved = false;

  const onMove = (moveEvent) => {
    if (!moved && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 5) return;
    moved = true;
    if (!selectionBox) {
      selectionBox = document.createElement("div");
      selectionBox.className = "selection-box";
      canvas.appendChild(selectionBox);
    }
    const canvasRect = canvas.getBoundingClientRect();
    const left = Math.min(startX, moveEvent.clientX) - canvasRect.left + canvas.scrollLeft;
    const top = Math.min(startY, moveEvent.clientY) - canvasRect.top + canvas.scrollTop;
    const width = Math.abs(moveEvent.clientX - startX);
    const height = Math.abs(moveEvent.clientY - startY);
    Object.assign(selectionBox.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`
    });
  };

  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (moved && selectionBox) {
      const boxRect = selectionBox.getBoundingClientRect();
      selectedSteps = Array.from(canvas.querySelectorAll(".flow-step"))
        .filter((step) => rectsIntersect(boxRect, step.getBoundingClientRect()))
        .map((step) => step.dataset.stepId);
      activeStep = selectedSteps.length ? { stationId: canvas.dataset.stationCanvas || getProgramStationId(), stepId: selectedSteps[selectedSteps.length - 1] } : null;
      activeConditionBox = null;
      selectionBox.remove();
      selectionBox = null;
      renderAll();
    }
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function startLadderMarqueeSelect(event, svg) {
  if (event.button !== 0) return;
  const stationId = svg.closest(".station-workspace")?.dataset.stationId;
  const stepId = svg.dataset.ladderSvg;
  if (!stationId || !stepId) return;
  const host = svg.closest(".condition-row");
  if (!host) return;
  const startX = event.clientX;
  const startY = event.clientY;
  let moved = false;

  const onMove = (moveEvent) => {
    if (!moved && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 5) return;
    moved = true;
    if (!selectionBox) {
      selectionBox = document.createElement("div");
      selectionBox.className = "selection-box ladder-selection-box";
      host.appendChild(selectionBox);
    }
    const hostRect = host.getBoundingClientRect();
    Object.assign(selectionBox.style, {
      left: `${Math.min(startX, moveEvent.clientX) - hostRect.left}px`,
      top: `${Math.min(startY, moveEvent.clientY) - hostRect.top}px`,
      width: `${Math.abs(moveEvent.clientX - startX)}px`,
      height: `${Math.abs(moveEvent.clientY - startY)}px`
    });
  };

  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (moved && selectionBox) {
      const boxRect = selectionBox.getBoundingClientRect();
      selectedCells = Array.from(svg.querySelectorAll("[data-ladder-cell]"))
        .filter((cell) => rectsIntersect(boxRect, cell.getBoundingClientRect()))
        .map((cell) => ({
          stationId,
          stepId,
          row: Number(cell.dataset.row),
          col: Number(cell.dataset.col)
        }));
      selectedComponent = selectedCells.length
        ? { type: "ladderCell", stationId, stepId, id: `${selectedCells[0].row}:${selectedCells[0].col}` }
        : null;
      activeStep = { stationId, stepId };
      activeConditionBox = { stationId, stepId };
      activeCellMenu = null;
      activeGridContext = null;
      suppressLadderClick = true;
      selectionBox.remove();
      selectionBox = null;
      renderAll();
    }
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function rectsIntersect(a, b) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function handleStepButton(stationId, stepId, action) {
  const work = getWork(stationId);
  const index = work.steps.findIndex((step) => step.id === stepId);
  if (index < 0) return;
  if (action === "add-condition-box") {
    work.steps[index].hasConditionBox = true;
    activeConditionBox = { stationId, stepId };
    activeStep = { stationId, stepId };
  }
  if (action === "delete-step") {
    work.steps.splice(index, 1);
    work.arrows = work.arrows.filter((arrowIndex) => arrowIndex !== index && arrowIndex <= work.steps.length);
  }
  if (action === "move-up" && index > 0) {
    [work.steps[index - 1], work.steps[index]] = [work.steps[index], work.steps[index - 1]];
  }
  if (action === "move-down" && index < work.steps.length - 1) {
    [work.steps[index + 1], work.steps[index]] = [work.steps[index], work.steps[index + 1]];
  }
  markDirty(stationId);
  saveAndRender();
}

function handleConditionButton(button) {
  const chip = button.closest("[data-condition-id]");
  const step = getStep(chip.dataset.stationId, chip.dataset.stepId);
  const condition = step.conditions.find((item) => item.id === chip.dataset.conditionId);
  if (!condition) return;
  if (button.dataset.condAction === "toggle") {
    condition.contact = condition.contact === "NC" ? "NO" : "NC";
  } else {
    step.conditions = step.conditions.filter((item) => item.id !== condition.id);
  }
  markDirty(chip.dataset.stationId);
  saveAndRender();
}

function addPayloadActionToStep(stationId, stepId, payload) {
  const step = getStep(stationId, stepId);
  if (!step) return;
  if (payload.kind === "delay") {
    step.actions.push(createDelayAction(payload.item.defaultMs || 1000, payload.item.name));
  } else if (payload.kind === "actuator") {
    step.actions.push(createAction(payload.item, payload.item.actions[0]));
  } else if (payload.kind === "existingAction") {
    moveExistingAction(payload, stationId, stepId);
  }
  activeStep = { stationId, stepId };
  markDirty(stationId);
}

function addArrow(stationId, index) {
  const work = getWork(stationId);
  if (!work.arrows.includes(index)) work.arrows.push(index);
  work.arrows.sort((a, b) => a - b);
}

function startExistingActionDrag(event, card) {
  if (event.button !== 0 || !event.target.closest(".drag-handle")) return;
  const sourceStationId = card.dataset.stationId;
  const sourceStepId = card.dataset.stepId;
  const sourceStep = getStep(sourceStationId, sourceStepId);
  const action = sourceStep?.actions.find((item) => item.id === card.dataset.actionId);
  if (!action) return;

  const payload = {
    kind: "existingAction",
    sourceStationId,
    sourceStepId,
    actionId: action.id,
    action: cloneAction(action)
  };
  const startX = event.clientX;
  const startY = event.clientY;
  pointerDrag = { payload, startX, startY, ghost: null, dragging: false };

  const onMove = (moveEvent) => {
    if (!pointerDrag) return;
    if (!pointerDrag.dragging && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 5) {
      pointerDrag.dragging = true;
      pointerDrag.ghost = card.cloneNode(true);
      pointerDrag.ghost.classList.add("drag-ghost", "action-ghost");
      document.body.appendChild(pointerDrag.ghost);
      card.classList.add("is-moving");
    }
    if (pointerDrag.ghost) {
      pointerDrag.ghost.style.transform = `translate(${moveEvent.clientX + 10}px, ${moveEvent.clientY + 10}px)`;
    }
    document.querySelectorAll(".node-actions.is-over, .flow-arrow.is-over").forEach((zone) => zone.classList.remove("is-over"));
    const zone = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest(".node-actions, .flow-arrow");
    if (zone) zone.classList.add("is-over");
  };

  const onUp = (upEvent) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    document.querySelectorAll(".node-actions.is-over, .flow-arrow.is-over").forEach((zone) => zone.classList.remove("is-over"));
    card.classList.remove("is-moving");
    if (pointerDrag?.dragging) {
      const zone = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest(".node-actions, .flow-arrow");
      if (zone) dropExistingActionOnZone(zone, payload);
    }
    pointerDrag?.ghost?.remove();
    pointerDrag = null;
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function startStepDrag(event, stepNode) {
  if (event.button !== 0) return;
  const stationId = stepNode.dataset.stationId;
  const stepId = stepNode.dataset.stepId;
  const startX = event.clientX;
  const startY = event.clientY;
  pointerDrag = { kind: "step", stationId, stepId, startX, startY, ghost: null, dragging: false };

  const onMove = (moveEvent) => {
    if (!pointerDrag) return;
    if (!pointerDrag.dragging && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 5) {
      pointerDrag.dragging = true;
      suppressStepClick = true;
      pointerDrag.ghost = stepNode.cloneNode(true);
      pointerDrag.ghost.classList.add("drag-ghost", "step-ghost");
      document.body.appendChild(pointerDrag.ghost);
      stepNode.classList.add("is-moving");
    }
    if (pointerDrag.ghost) {
      pointerDrag.ghost.style.transform = `translate(${moveEvent.clientX + 10}px, ${moveEvent.clientY + 10}px)`;
    }
    document.querySelectorAll(".flow-step.is-over, .flow-arrow.is-over, .empty-canvas.is-over").forEach((zone) => zone.classList.remove("is-over"));
    const zone = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest(".flow-step, .flow-arrow, .empty-canvas");
    if (zone && zone !== stepNode) zone.classList.add("is-over");
  };

  const onUp = (upEvent) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    document.querySelectorAll(".flow-step.is-over, .flow-arrow.is-over, .empty-canvas.is-over").forEach((zone) => zone.classList.remove("is-over"));
    stepNode.classList.remove("is-moving");
    if (pointerDrag?.dragging) {
      const zone = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest(".flow-step, .flow-arrow, .empty-canvas");
      if (zone && zone !== stepNode) dropStepOnZone(zone, { stationId, stepId });
    }
    pointerDrag?.ghost?.remove();
    pointerDrag = null;
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function dropStepOnZone(zone, payload) {
  const stationNode = zone.closest(".station-workspace");
  if (!stationNode || stationNode.dataset.stationId !== payload.stationId) return;
  const work = getWork(payload.stationId);
  const fromIndex = work.steps.findIndex((step) => step.id === payload.stepId);
  if (fromIndex < 0) return;
  let toIndex = work.steps.length;
  if (zone.classList.contains("flow-step")) {
    toIndex = Number(zone.dataset.stepIndex);
  }
  if (zone.classList.contains("flow-arrow")) {
    toIndex = Number(zone.dataset.flowArrow);
  }
  if (toIndex > fromIndex) toIndex -= 1;
  if (toIndex === fromIndex) return;
  const [step] = work.steps.splice(fromIndex, 1);
  work.steps.splice(Math.max(0, Math.min(toIndex, work.steps.length)), 0, step);
  activeStep = { stationId: payload.stationId, stepId: payload.stepId };
  activeConditionBox = step.hasConditionBox ? { stationId: payload.stationId, stepId: payload.stepId } : null;
  markDirty(payload.stationId);
  saveAndRender();
}

function dropExistingActionOnZone(zone, payload) {
  const stationNode = zone.closest(".station-workspace");
  if (!stationNode) return;
  const stationId = stationNode.dataset.stationId;
  if (zone.classList.contains("flow-arrow")) {
    const work = getWork(stationId);
    const step = createStep();
    const insertIndex = Number(zone.dataset.flowArrow);
    work.arrows = work.arrows.map((index) => (index > insertIndex ? index + 1 : index));
    work.steps.splice(insertIndex, 0, step);
    moveExistingAction(payload, stationId, step.id);
  } else {
    const step = zone.closest(".flow-step");
    if (step) moveExistingAction(payload, stationId, step.dataset.stepId);
  }
  markDirty(payload.sourceStationId);
  markDirty(stationId);
  saveAndRender();
}

function moveExistingAction(payload, targetStationId, targetStepId) {
  if (payload.sourceStationId === targetStationId && payload.sourceStepId === targetStepId) return;
  const sourceStep = getStep(payload.sourceStationId, payload.sourceStepId);
  const targetStep = getStep(targetStationId, targetStepId);
  if (!sourceStep || !targetStep) return;
  sourceStep.actions = sourceStep.actions.filter((action) => action.id !== payload.actionId);
  targetStep.actions.push(cloneAction(payload.action));
  removeEmptySteps(payload.sourceStationId);
  activeStep = { stationId: targetStationId, stepId: targetStep.id };
}

function removeEmptySteps(stationId) {
  const work = getWork(stationId);
  work.steps = work.steps.filter((step) => step.comment || step.actions.length || step.conditions.length || step.ladder?.elements?.length || step.hasConditionBox);
}

function runAiCompletion() {
  [getStation(getProgramStationId())].forEach((station) => {
    const work = getWork(station.id);
    const summary = [];
    work.steps.forEach((step, index) => {
      const doneCount = step.actions.filter((action) => action.waitDone !== false && action.done && action.done !== "TRUE").length;
      const timeoutCount = step.actions.filter((action) => action.type !== "delay" && action.waitDone !== false).length;
      const alarmCount = timeoutCount;
      const nextStep = index < work.steps.length - 1 ? (index + 2) * 10 : 0;
      step.ai = { doneCount, timeoutCount, alarmCount, nextStep };
      step.actions.forEach((action) => {
        if (!action.timeoutMs) action.timeoutMs = defaultTimeout(action.type);
        if (!action.alarm) action.alarm = `${action.deviceName}${action.actionLabel}超时`;
      });
      if (step.actions.length) {
        summary.push(`Step ${(index + 1) * 10}: 完成 ${doneCount} / 超时 ${timeoutCount} / 报警 ${alarmCount}`);
      }
    });
    work.aiCompleted = true;
    work.aiSummary = summary.length ? summary : ["当前工站没有动作。"];
  });
}

function compileStationLogic(stationId = state.currentStationId) {
  const work = getWork(stationId);
  ensureStepSystemNumbers(work);
  const issues = [];
  work.steps.forEach((step, index) => {
    if (!step.hasConditionBox) return;
    const ladder = ensureLadderStep(step);
    const result = compileLadderStep(ladder, step, work, index);
    step.compiledLogic = result.expression;
    step.compiledCoils = result.coils;
    issues.push(...result.issues);
  });
  work.codeEdited = false;
  work.aiCompleted = true;
  work.aiSummary = issues.length
    ? issues
    : ["编译通过：条件框已转换为本地逻辑表达式。"];
}

function compileLadderStep(ladder, step, work, stepIndex) {
  const issues = [];
  const stepName = `S${getStepSystemNo(step, stepIndex)}`;
  const coils = [];
  ladder.cells.forEach((cell) => {
    normalizeCellSegments(cell);
    ["left", "right"].forEach((side) => {
      ["top", "bottom"].forEach((segment) => {
        if (getCellEdgeSegment(cell, side, segment) && !canSetCellEdgeSegment(ladder, cell.row, cell.col, side, segment)) {
          issues.push(`${stepName}: R${cell.row + 1}C${cell.col + 1} ${side === "left" ? "左" : "右"}${segment === "top" ? "上" : "下"}竖线悬空`);
        }
      });
    });
    if (["NO", "NC", "RISING", "FALLING"].includes(cell.value) && !cell.binding) {
      issues.push(`${stepName}: R${cell.row + 1}C${cell.col + 1} 触点未绑定变量`);
    }
    if (cell.value === "coil" && !hasRowLogicBefore(ladder, cell.row, cell.col)) {
      issues.push(`${stepName}: R${cell.row + 1}C${cell.col + 1} 线圈左侧没有有效逻辑`);
    }
    if (cell.value === "coil" && hasSignalAfter(ladder, cell.row, cell.col)) {
      issues.push(`${stepName}: R${cell.row + 1}C${cell.col + 1} 线圈不是分支最后一个输出`);
    }
    if (cell.value !== "empty" && cell.value !== "coil" && hasCoilBefore(ladder, cell.row, cell.col)) {
      issues.push(`${stepName}: R${cell.row + 1}C${cell.col + 1} 条件位于线圈右侧，不符合梯形图输出端规则`);
    }
  });
  const coilCells = getLadderCoils(ladder);
  coilCells.forEach((coil, coilIndex) => {
    const expression = compileCoilExpression(ladder, coil);
    if (!expression) {
      issues.push(`${stepName}: R${coil.row + 1}C${coil.col + 1} 线圈无法解析到有效条件`);
    }
    coils.push({
      row: coil.row,
      col: coil.col,
      name: `箭头${coilIndex + 1}`,
      expression: expression || "FALSE",
      targetStepNo: getCoilTargetSystemNo(work, stepIndex, coil)
    });
  });
  const fallbackRows = [];
  for (let row = 0; row < ladder.rows; row += 1) {
    const expr = compileRowExpressionBefore(ladder, row, ladder.cols);
    if (expr) fallbackRows.push(`(${expr})`);
  }
  const expressions = coils.length
    ? coils.map((coil) => `(${coil.expression})`)
    : fallbackRows;
  return {
    expression: expressions.length ? expressions.join(" OR ") : "",
    issues,
    coils
  };
}

function getCoilTargetSystemNo(work, stepIndex, coil) {
  if (coil.targetStepId) {
    const targetIndex = work.steps.findIndex((step) => step.id === coil.targetStepId);
    if (targetIndex >= 0) return getStepSystemNo(work.steps[targetIndex], targetIndex);
  }
  return getNextStepSystemNo(work, stepIndex);
}

function hasRowLogicBefore(ladder, row, col) {
  return ladder.cells.some((cell) =>
    cell.row === row &&
    cell.col < col &&
    ["NO", "NC", "RISING", "FALLING", "wire"].includes(cell.value)
  );
}

function hasSignalAfter(ladder, row, col) {
  return ladder.cells.some((cell) =>
    cell.row === row &&
    cell.col > col &&
    ["NO", "NC", "RISING", "FALLING", "wire", "coil"].includes(cell.value)
  );
}

function hasCoilBefore(ladder, row, col) {
  return ladder.cells.some((cell) =>
    cell.row === row &&
    cell.col < col &&
    cell.value === "coil"
  );
}

function getLadderCoils(ladder) {
  return ladder.cells
    .filter((cell) => cell.value === "coil")
    .sort((a, b) => a.row - b.row || a.col - b.col);
}

function getStepCoilCount(step) {
  if (!step?.hasConditionBox) return 0;
  const ladder = ensureLadderStep(step);
  return getLadderCoils(ladder).length;
}

function compileCoilExpression(ladder, coil) {
  const rows = getRowsConnectedToCoil(ladder, coil);
  const expressions = [...rows]
    .sort((a, b) => a - b)
    .map((row) => compileRowExpressionBefore(ladder, row, coil.col))
    .filter(Boolean)
    .map((expr) => `(${expr})`);
  return expressions.join(" OR ");
}

function compileRowExpressionBefore(ladder, row, beforeCol) {
  const contacts = ladder.cells
    .filter((cell) => cell.row === row && cell.col < beforeCol && ["NO", "NC", "RISING", "FALLING"].includes(cell.value))
    .sort((a, b) => a.col - b.col);
  return toLogicExpression(contacts);
}

function getRowsConnectedToCoil(ladder, coil) {
  const connected = new Set([coil.row]);
  let changed = true;
  while (changed) {
    changed = false;
    for (let row = 0; row < ladder.rows - 1; row += 1) {
      if (!connected.has(row) && !connected.has(row + 1)) continue;
      for (let col = 0; col <= coil.col; col += 1) {
        if (!hasVerticalConnectionBetweenRows(ladder, row, col)) continue;
        const size = connected.size;
        connected.add(row);
        connected.add(row + 1);
        if (connected.size !== size) changed = true;
      }
    }
  }
  return connected;
}

function hasVerticalConnectionBetweenRows(ladder, upperRow, col) {
  const upper = findLadderCell(ladder, upperRow, col);
  const lower = findLadderCell(ladder, upperRow + 1, col);
  return ["left", "right"].some((side) =>
    (upper && getCellEdgeSegment(upper, side, "bottom")) ||
    (lower && getCellEdgeSegment(lower, side, "top"))
  );
}

function tidyStationLogic(stationId = state.currentStationId) {
  const work = getWork(stationId);
  let changed = 0;
  activeCellMenu = null;
  activeGridContext = null;
  work.steps.forEach((step) => {
    if (!step.hasConditionBox) return;
    const ladder = ensureLadderStep(step);
    const used = ladder.cells.filter(isUsedLadderCell);
    const minRow = used.length ? Math.min(...used.map((cell) => cell.row)) : 0;
    const minCol = used.length ? Math.min(...used.map((cell) => cell.col)) : 0;
    if (minRow || minCol) {
      ladder.cells.forEach((cell) => {
        cell.row = Math.max(0, cell.row - minRow);
        cell.col = Math.max(0, cell.col - minCol);
      });
      changed += 1;
    }
    const normalizedUsed = ladder.cells.filter(isUsedLadderCell);
    const maxRow = normalizedUsed.length ? Math.max(...normalizedUsed.map((cell) => cell.row)) : LADDER_MIN_ROWS - 1;
    const maxCol = normalizedUsed.length ? Math.max(...normalizedUsed.map((cell) => cell.col)) : LADDER_MIN_COLS - 1;
    const rows = Math.max(LADDER_MIN_ROWS, maxRow + 1);
    const cols = Math.max(LADDER_MIN_COLS, maxCol + 1);
    if (rows !== ladder.rows || cols !== ladder.cols) changed += 1;
    ladder.rows = rows;
    ladder.cols = cols;
    ladder.cells = ladder.cells.filter((cell) => cell.row < rows && cell.col < cols && (isUsedLadderCell(cell) || ["NO", "NC", "RISING", "FALLING", "wire", "coil"].includes(cell.value)));
  });
  const workRef = getWork(stationId);
  workRef.codeEdited = false;
  workRef.aiCompleted = true;
  workRef.aiSummary = [`整理完成：已压缩 ${changed} 个条件框，最小尺寸保留 3 × 1。`];
}

function isUsedLadderCell(cell) {
  if (!cell) return false;
  normalizeCellSegments(cell);
  return cell.value !== "empty" ||
    cell.leftSegments.some(Boolean) ||
    cell.rightSegments.some(Boolean);
}

function ensureStepSystemNumbers(work) {
  const used = new Set();
  work.steps.forEach((step, index) => {
    let no = Number(step.systemNo);
    if (!Number.isFinite(no) || no <= 0 || used.has(no)) {
      no = (index + 1) * 10;
      while (used.has(no)) no += 10;
      step.systemNo = no;
    }
    used.add(no);
  });
}

function getStepSystemNo(step, index = 0) {
  const no = Number(step?.systemNo);
  return Number.isFinite(no) && no > 0 ? no : (index + 1) * 10;
}

function getNextStepSystemNo(work, index) {
  return index < work.steps.length - 1 ? getStepSystemNo(work.steps[index + 1], index + 1) : 0;
}

function renderAiSummary() {
  const station = getStation(getCodeStationId());
  const work = getWork(station.id);
  if (work.codeEdited) {
    els.aiSummary.textContent = "代码已手动编辑，画布步骤已标记。";
    return;
  }
  if (!work.aiCompleted) {
    els.aiSummary.textContent = "尚未编译。";
    return;
  }
  els.aiSummary.textContent = work.aiSummary.join(" ");
}

function getCoilLinks(work) {
  ensureStepSystemNumbers(work);
  const links = [];
  work.steps.forEach((step, stepIndex) => {
    if (!step.hasConditionBox) return;
    const ladder = ensureLadderStep(step);
    getLadderCoils(ladder).forEach((coil, coilIndex) => {
      const targetStepId = coil.targetStepId || "";
      const targetIndex = targetStepId ? work.steps.findIndex((candidate) => candidate.id === targetStepId) : -1;
      links.push({
        sourceStepId: step.id,
        sourceStepNo: getStepSystemNo(step, stepIndex),
        targetStepId,
        targetStepNo: targetIndex >= 0 ? getStepSystemNo(work.steps[targetIndex], targetIndex) : getNextStepSystemNo(work, stepIndex),
        coilIndex,
        row: coil.row,
        col: coil.col
      });
    });
  });
  return links;
}

function setSummaryMessage(message) {
  els.aiSummary.textContent = message;
}

function jumpToStep(stationId, stepId) {
  const node = els.stationScroller.querySelector(`[data-station-id="${stationId}"] [data-step-id="${stepId}"]`);
  if (!node) return;
  activeStep = { stationId, stepId };
  selectedSteps = [stepId];
  node.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  renderAll();
}

function renderCodePreview() {
  const station = getStation(getCodeStationId());
  const work = getWork(station.id);
  els.codeHint.textContent = work.codeEdited ? "已编辑" : "未编辑";
  els.toggleVariableBtn.classList.toggle("is-on", state.variableVisible);
  els.toggleProgramBtn.classList.toggle("is-on", state.programVisible);
  els.toggleCodeBtn.classList.toggle("is-on", state.codeVisible);
  if (els.codeStationSelect) {
    const options = renderStationOptions(station.id);
    if (els.codeStationSelect.innerHTML !== options) els.codeStationSelect.innerHTML = options;
    if (els.codeStationSelect.value !== station.id) els.codeStationSelect.value = station.id;
  }
  const code = work.codeEdited ? work.codeOverride : generateCode(station.id);
  if (els.codePreview.value !== code) els.codePreview.value = code;
  if (!activeCodeToken || !hasCodeToken(code, activeCodeToken)) {
    activeCodeToken = findFirstCodeIdentifier(code);
  }
  renderCodeHighlight(code);
  updateCodeEditorChrome();
}

function renderCodeHighlight(code) {
  if (!els.codeHighlight) return;
  if (code === lastHighlightedCode && activeCodeToken === lastHighlightedToken) {
    syncCodeHighlightScroll();
    return;
  }
  lastHighlightedCode = code;
  lastHighlightedToken = activeCodeToken;
  els.codeHighlight.innerHTML = highlightStCode(code);
  syncCodeHighlightScroll();
}

function syncCodeHighlightScroll() {
  if (!els.codeHighlight || !els.codePreview) return;
  els.codeHighlight.scrollTop = els.codePreview.scrollTop;
  els.codeHighlight.scrollLeft = els.codePreview.scrollLeft;
  if (els.codeLineNumbers) els.codeLineNumbers.scrollTop = els.codePreview.scrollTop;
  updateCodeActiveLine();
}

function updateCodeEditorChrome() {
  renderCodeLineNumbers();
  updateCodeCursorInfo();
  updateCodeActiveLine();
}

function renderCodeLineNumbers() {
  if (!els.codeLineNumbers || !els.codePreview) return;
  const lineCount = Math.max(1, els.codePreview.value.split("\n").length);
  const numbers = Array.from({ length: lineCount }, (_, index) => String(index + 1)).join("\n");
  if (els.codeLineNumbers.textContent !== numbers) els.codeLineNumbers.textContent = numbers;
  els.codeLineNumbers.scrollTop = els.codePreview.scrollTop;
}

function updateCodeCursorInfo() {
  if (!els.codeCursorInfo || !els.codePreview) return;
  const { line, col } = getCodeCursorPosition();
  const selected = Math.abs(els.codePreview.selectionEnd - els.codePreview.selectionStart);
  els.codeCursorInfo.textContent = `Ln ${line}, Col ${col}${selected ? ` · Sel ${selected}` : ""}`;
}

function updateCodeActiveLine() {
  if (!els.codeActiveLine || !els.codePreview) return;
  const { line } = getCodeCursorPosition();
  const styles = getComputedStyle(els.codePreview);
  const lineHeight = parseFloat(styles.lineHeight) || 16;
  const paddingTop = parseFloat(styles.paddingTop) || 0;
  els.codeActiveLine.style.top = `${paddingTop + (line - 1) * lineHeight - els.codePreview.scrollTop}px`;
  els.codeActiveLine.style.height = `${lineHeight}px`;
}

function getCodeCursorPosition() {
  const value = els.codePreview?.value || "";
  const pos = els.codePreview?.selectionStart || 0;
  const before = value.slice(0, pos);
  const lines = before.split("\n");
  return {
    line: lines.length,
    col: lines[lines.length - 1].length + 1
  };
}

function indentCodeSelection(outdent = false) {
  const textarea = els.codePreview;
  if (!textarea) return;
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEndIndex = value.indexOf("\n", end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  const nextLines = outdent
    ? lines.map((line) => line.startsWith("    ") ? line.slice(4) : line.replace(/^\t/, ""))
    : lines.map((line) => `    ${line}`);
  const nextBlock = nextLines.join("\n");
  const nextValue = `${value.slice(0, lineStart)}${nextBlock}${value.slice(lineEnd)}`;
  textarea.value = nextValue;
  const delta = nextBlock.length - block.length;
  textarea.setSelectionRange(Math.max(lineStart, start + (outdent ? Math.min(0, delta) : 4)), Math.max(lineStart, end + delta));
  commitCodeEditorValue(nextValue);
}

function commitCodeEditorValue(code) {
  const work = getWork(getCodeStationId());
  work.codeOverride = code;
  work.codeEdited = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateActiveCodeTokenFromEditor();
  renderCodeHighlight(code);
  updateCodeEditorChrome();
  updateCodeEditBadges();
  renderAiSummary();
}

function handleCodeEditorKeydown(event) {
  const command = event.metaKey || event.ctrlKey;
  if (command && event.key.toLowerCase() === "f") {
    els.codeFindInput?.focus();
    els.codeFindInput?.select();
    event.preventDefault();
    return;
  }
  if (command && event.code === "Space") {
    updateCodeAutocomplete(true);
    event.preventDefault();
    return;
  }
  if (isCodeSuggestOpen() && event.key === "ArrowDown") {
    codeSuggestIndex = (codeSuggestIndex + 1) % codeSuggestItems.length;
    renderCodeSuggest();
    event.preventDefault();
    return;
  }
  if (isCodeSuggestOpen() && event.key === "ArrowUp") {
    codeSuggestIndex = (codeSuggestIndex - 1 + codeSuggestItems.length) % codeSuggestItems.length;
    renderCodeSuggest();
    event.preventDefault();
    return;
  }
  if (isCodeSuggestOpen() && (event.key === "Enter" || event.key === "Tab")) {
    applyCodeSuggestion(codeSuggestIndex);
    event.preventDefault();
    return;
  }
  if (event.key === "Escape") {
    closeCodeSuggest();
    event.preventDefault();
    return;
  }
  if (event.key === "Tab") {
    indentCodeSelection(event.shiftKey);
    event.preventDefault();
  }
}

function updateCodeAutocomplete(force = false) {
  const context = getCodeCompletionContext();
  if (!context && !force) {
    closeCodeSuggest();
    return;
  }
  const effectiveContext = context || {
    fragment: "",
    start: els.codePreview.selectionStart,
    end: els.codePreview.selectionStart,
    base: "",
    prefix: "",
    member: false
  };
  codeSuggestItems = buildCodeSuggestions(effectiveContext).slice(0, 9);
  codeSuggestIndex = 0;
  if (!codeSuggestItems.length) {
    closeCodeSuggest();
    return;
  }
  renderCodeSuggest(effectiveContext);
}

function selectCodeFindMatch(direction = 1, fromInput = false) {
  if (!els.codePreview || !els.codeFindInput) return;
  const query = els.codeFindInput.value;
  if (!query) {
    updateCodeEditorChrome();
    return;
  }
  const source = els.codePreview.value;
  const lowerSource = source.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const cursor = direction < 0 ? els.codePreview.selectionStart : els.codePreview.selectionEnd;
  let index = direction < 0
    ? lowerSource.lastIndexOf(lowerQuery, Math.max(0, cursor - (fromInput ? 0 : 1)))
    : lowerSource.indexOf(lowerQuery, fromInput ? 0 : cursor);
  if (index < 0) {
    index = direction < 0 ? lowerSource.lastIndexOf(lowerQuery) : lowerSource.indexOf(lowerQuery);
  }
  if (index < 0) return;
  els.codePreview.focus();
  els.codePreview.setSelectionRange(index, index + query.length);
  activeCodeToken = isHighlightableCodeToken(query) ? (query.includes(".") ? query.split(".")[0] : query) : activeCodeToken;
  renderCodeHighlight(source);
  updateCodeEditorChrome();
}

function getCodeCompletionContext() {
  if (!els.codePreview) return null;
  const pos = els.codePreview.selectionStart;
  const source = els.codePreview.value;
  let start = pos;
  while (start > 0 && isCodeTokenChar(source[start - 1])) start -= 1;
  const fragment = source.slice(start, pos);
  if (fragment.length < 1) return null;
  const firstSegment = fragment.split(".")[0];
  if (!isCodeIdentifierToken(firstSegment)) return null;
  const dotIndex = fragment.lastIndexOf(".");
  return {
    fragment,
    start,
    end: pos,
    base: dotIndex >= 0 ? fragment.slice(0, dotIndex) : "",
    prefix: dotIndex >= 0 ? fragment.slice(dotIndex + 1) : fragment,
    member: dotIndex >= 0
  };
}

function buildCodeSuggestions(context) {
  const prefix = context.prefix.toLowerCase();
  if (context.member) {
    return ST_STRUCT_FIELDS
      .filter((field) => field.toLowerCase().startsWith(prefix))
      .map((field) => ({
        insert: `${context.base}.${field}`,
        label: field,
        meta: "STRUCT"
      }));
  }
  return getCodeCompletionSymbols(getCodeStationId())
    .filter((item) => item.label.toLowerCase().startsWith(prefix))
    .filter((item) => item.label !== context.fragment)
    .slice(0, 20);
}

function renderCodeSuggest(context = getCodeCompletionContext()) {
  if (!els.codeSuggest || !context || !codeSuggestItems.length) return;
  els.codeSuggest.hidden = false;
  els.codeSuggest.innerHTML = codeSuggestItems.map((item, index) => `
    <button class="${index === codeSuggestIndex ? "is-active" : ""}" data-code-suggest-index="${index}">
      <span>${escapeHtml(item.label)}</span>
      <small>${escapeHtml(item.meta || "")}</small>
    </button>
  `).join("");
  positionCodeSuggest(context);
}

function positionCodeSuggest(context) {
  const editor = els.codePreview.closest(".code-editor");
  const lineHeight = parseFloat(getComputedStyle(els.codePreview).lineHeight) || 16;
  const charWidth = 7;
  const before = els.codePreview.value.slice(0, context.end);
  const lineStart = before.lastIndexOf("\n") + 1;
  const line = before.slice(0, context.end).split("\n").length - 1;
  const col = context.end - lineStart;
  const left = Math.min(editor.clientWidth - 210, 10 + col * charWidth - els.codePreview.scrollLeft);
  const top = Math.min(editor.clientHeight - 210, 10 + (line + 1) * lineHeight - els.codePreview.scrollTop);
  els.codeSuggest.style.left = `${Math.max(8, left)}px`;
  els.codeSuggest.style.top = `${Math.max(8, top)}px`;
}

function closeCodeSuggest() {
  codeSuggestItems = [];
  codeSuggestIndex = 0;
  if (els.codeSuggest) {
    els.codeSuggest.hidden = true;
    els.codeSuggest.innerHTML = "";
  }
}

function isCodeSuggestOpen() {
  return Boolean(els.codeSuggest && !els.codeSuggest.hidden && codeSuggestItems.length);
}

function applyCodeSuggestion(index) {
  const item = codeSuggestItems[index];
  const context = getCodeCompletionContext();
  if (!item || !context) return;
  const value = els.codePreview.value;
  const next = `${value.slice(0, context.start)}${item.insert}${value.slice(context.end)}`;
  const caret = context.start + item.insert.length;
  els.codePreview.value = next;
  els.codePreview.setSelectionRange(caret, caret);
  const work = getWork(getCodeStationId());
  work.codeOverride = next;
  work.codeEdited = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  activeCodeToken = item.insert.includes(".") ? item.insert.split(".")[0] : item.insert;
  closeCodeSuggest();
  renderCodeHighlight(next);
  updateCodeEditorChrome();
  updateCodeEditBadges();
  renderAiSummary();
  els.codePreview.focus();
}

function updateActiveCodeTokenFromEditor() {
  if (!els.codePreview) return;
  const token = getCodeTokenAtSelection(els.codePreview.value, els.codePreview.selectionStart, els.codePreview.selectionEnd);
  if (token === activeCodeToken) return;
  activeCodeToken = token;
  renderCodeHighlight(els.codePreview.value);
}

function selectCodeTokenAtCaret() {
  if (!els.codePreview) return;
  const code = els.codePreview.value;
  let left = els.codePreview.selectionStart;
  let right = els.codePreview.selectionEnd;
  while (left > 0 && isCodeTokenChar(code[left - 1])) left -= 1;
  while (right < code.length && isCodeTokenChar(code[right])) right += 1;
  const token = code.slice(left, right);
  if (!isHighlightableCodeToken(token)) return;
  els.codePreview.setSelectionRange(left, right);
  activeCodeToken = token.includes(".") ? token.split(".")[0] : token;
  renderCodeHighlight(code);
  updateCodeEditorChrome();
  updateCodeAutocomplete();
}

function getCodeTokenAtSelection(code, start, end) {
  const source = String(code || "");
  const selected = source.slice(start, end).trim();
  if (isHighlightableCodeToken(selected)) return selected;
  let left = start;
  let right = start;
  while (left > 0 && isCodeTokenChar(source[left - 1])) left -= 1;
  while (right < source.length && isCodeTokenChar(source[right])) right += 1;
  const token = source.slice(left, right);
  return isHighlightableCodeToken(token) ? token : "";
}

function isHighlightableCodeToken(token) {
  return isCodeIdentifierToken(token) && !isStKeyword(token);
}

function hasCodeToken(code, token) {
  if (!isHighlightableCodeToken(token)) return false;
  return tokenizeStCode(code).some((item) => item.type === "identifier" && (item.value === token || item.value.split(".")[0] === token));
}

function findFirstCodeIdentifier(code) {
  for (const item of tokenizeStCode(code)) {
    if (item.type === "identifier" && isHighlightableCodeToken(item.value)) {
      return item.value.includes(".") ? item.value.split(".")[0] : item.value;
    }
  }
  return "";
}

function getCodeCompletionSymbols(stationId) {
  const symbols = new Map();
  const add = (label, meta = "VAR") => {
    const clean = String(label || "").trim();
    if (!isHighlightableCodeToken(clean)) return;
    if (!symbols.has(clean)) symbols.set(clean, { label: clean, insert: clean, meta });
  };
  ST_KEYWORDS.forEach((keyword) => symbols.set(keyword, { label: keyword, insert: keyword, meta: "ST" }));
  ["actuator", "sensor", "system", "delay", "local", "global"].forEach((kind) => {
    getLibraryItems(stationId, kind).forEach((item) => {
      add(item.expression, kind.toUpperCase());
      add(normalizeName(item.name), kind.toUpperCase());
      getConditionPoints(kind, item).forEach((point) => {
        add(point.expression, point.label || kind.toUpperCase());
        const parts = String(point.expression || "").split(".");
        if (parts.length > 1) add(parts[0], kind.toUpperCase());
      });
    });
  });
  getWork(stationId).steps.forEach((step, index) => {
    add(`Step${getStepSystemNo(step, index)}_Coil1`, "COIL");
  });
  ["Step", "ResetBtn", "StartBtn"].forEach((label) => add(label, "SYS"));
  return [...symbols.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function isStKeyword(token) {
  return ST_KEYWORDS.has(token) || ST_KEYWORDS.has(String(token).toUpperCase());
}

function isCodeIdentifierToken(token) {
  return String(token || "")
    .split(".")
    .every((part) => part && isCodeIdentifierStart(part[0]) && [...part].every((char, index) => index === 0 ? isCodeIdentifierStart(char) : isCodeIdentifierPart(char)));
}

function isCodeIdentifierStart(char) {
  return /[\p{L}_]/u.test(char || "");
}

function isCodeIdentifierPart(char) {
  return /[\p{L}\p{N}_]/u.test(char || "");
}

function isCodeTokenChar(char) {
  return char === "." || isCodeIdentifierPart(char);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenizeStCode(code) {
  const source = String(code || "");
  const pattern = /\/\/.*|'(?:[^']|'')*'|\bT#\d+ms\b|\b\d+\b|[\p{L}_][\p{L}\p{N}_]*(?:\.[\p{L}_][\p{L}\p{N}_]*)*/gu;
  return Array.from(source.matchAll(pattern), (match) => {
    const value = match[0];
    let type = "identifier";
    if (value.startsWith("//")) type = "comment";
    else if (value.startsWith("'")) type = "string";
    else if (/^(T#\d+ms|\d+)$/i.test(value)) type = "number";
    return { value, type, index: match.index };
  });
}

function highlightStCode(code) {
  const source = String(code || "");
  let output = "";
  let index = 0;
  for (const tokenInfo of tokenizeStCode(source)) {
    output += escapeHtml(source.slice(index, tokenInfo.index));
    const token = tokenInfo.value;
    if (tokenInfo.type === "comment") {
      output += `<span class="st-comment">${escapeHtml(token)}</span>`;
    } else if (tokenInfo.type === "string") {
      output += `<span class="st-string">${escapeHtml(token)}</span>`;
    } else if (tokenInfo.type === "number") {
      output += `<span class="st-number">${escapeHtml(token)}</span>`;
    } else if (isStKeyword(token)) {
      output += `<span class="st-keyword">${escapeHtml(token)}</span>`;
    } else if (activeCodeToken && (token === activeCodeToken || token.split(".")[0] === activeCodeToken)) {
      output += `<span class="st-active-var">${escapeHtml(token)}</span>`;
    } else {
      output += escapeHtml(token);
    }
    index = tokenInfo.index + token.length;
  }
  output += escapeHtml(source.slice(index));
  return output || " ";
}

function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
}

function captureScrollState() {
  const canvas = els.stationScroller?.querySelector(".flow-canvas");
  return {
    bodyTop: document.scrollingElement?.scrollTop || 0,
    bodyLeft: document.scrollingElement?.scrollLeft || 0,
    stationTop: els.stationScroller?.scrollTop || 0,
    stationLeft: els.stationScroller?.scrollLeft || 0,
    libraryScrolls: captureLibraryScrollState(),
    canvasTop: canvas?.scrollTop || 0,
    canvasLeft: canvas?.scrollLeft || 0
  };
}

function restoreScrollState(scroll) {
  const canvas = els.stationScroller.querySelector(".flow-canvas");
  els.stationScroller.scrollTop = scroll.stationTop;
  els.stationScroller.scrollLeft = scroll.stationLeft;
  restoreLibraryScrollState(scroll.libraryScrolls);
  if (canvas) {
    canvas.scrollTop = scroll.canvasTop;
    canvas.scrollLeft = scroll.canvasLeft;
  }
  if (document.scrollingElement) {
    document.scrollingElement.scrollTop = scroll.bodyTop;
    document.scrollingElement.scrollLeft = scroll.bodyLeft;
  }
}

function captureLibraryScrollState() {
  return [...els.stationScroller.querySelectorAll(".station-workspace")].map((workspace) => {
    const library = workspace.querySelector(".station-library");
    const groups = library?.querySelector(".library-groups");
    return {
      stationId: workspace.dataset.stationId || "",
      variableStationId: library?.dataset.variableStationId || "",
      top: groups?.scrollTop || 0,
      left: groups?.scrollLeft || 0
    };
  });
}

function restoreLibraryScrollState(scrolls = []) {
  scrolls.forEach((item) => {
    const workspace = [...els.stationScroller.querySelectorAll(".station-workspace")]
      .find((node) => node.dataset.stationId === item.stationId);
    const library = [...(workspace?.querySelectorAll(".station-library") || [])]
      .find((node) => node.dataset.variableStationId === item.variableStationId);
    const groups = library?.querySelector(".library-groups");
    if (!groups) return;
    groups.scrollTop = item.top;
    groups.scrollLeft = item.left;
  });
}

function focusWithoutScroll(element) {
  if (!element) return;
  try {
    element.focus({ preventScroll: true });
  } catch (error) {
    element.focus();
  }
}

function restoreState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.stations) {
      state = { ...createDefaultState(), ...parsed };
      projectData.stations.forEach((station) => {
        state.stations[station.id] = { ...createStationWork(), ...(state.stations[station.id] || {}) };
      });
    } else if (parsed?.currentStationId && Array.isArray(parsed.steps)) {
      state = createDefaultState();
      state.currentStationId = parsed.currentStationId;
      state.stations[parsed.currentStationId] = createStationWork({
        steps: parsed.steps.map((step) => ({
          ...step,
          hasConditionBox: Array.isArray(step.conditions) && step.conditions.length > 0
        })),
        aiCompleted: Boolean(parsed.aiCompleted),
        aiSummary: parsed.aiSummary || []
      });
    }
    hydrateState();
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function hydrateState() {
  if (!Array.isArray(state.globalVariables)) state.globalVariables = [];
  if (!state.globalNames) state.globalNames = {};
  if (!state.globalComments) state.globalComments = {};
  if (!state.globalTypes) state.globalTypes = {};
  if (!state.globalTargets) state.globalTargets = {};
  state.currentStationId = getStation(state.currentStationId)?.id || projectData.stations[0].id;
  state.variableStationId = getStation(state.variableStationId)?.id || state.currentStationId;
  state.programStationId = getStation(state.programStationId)?.id || state.currentStationId;
  state.codeStationId = getStation(state.codeStationId)?.id || state.currentStationId;
  state.variableStationPinned = Boolean(state.variableStationPinned);
  state.codeStationPinned = Boolean(state.codeStationPinned);
  if (typeof state.variableVisible === "undefined") state.variableVisible = true;
  if (typeof state.programVisible === "undefined") state.programVisible = true;
  if (typeof state.codeVisible === "undefined") state.codeVisible = true;
  if (!Array.isArray(state.visibleStationIds)) state.visibleStationIds = [];
  state.layout = { ...createDefaultState().layout, ...(state.layout || {}) };
  projectData.stations.forEach((station) => {
    const work = getWork(station.id);
    work.customItems = { ...createStationWork().customItems, ...(work.customItems || {}) };
    work.itemNames = work.itemNames || {};
    work.itemComments = work.itemComments || {};
    work.itemTypes = work.itemTypes || {};
    work.itemTargets = work.itemTargets || {};
    if (!Array.isArray(work.localVariables)) work.localVariables = [];
    if (!Array.isArray(work.steps)) work.steps = [];
    if (!Array.isArray(work.arrows)) work.arrows = [];
    splitCombinedConditionActionSteps(work);
    work.steps.forEach((step) => {
      if (!Number.isFinite(Number(step.systemNo)) || Number(step.systemNo) <= 0) step.systemNo = null;
      if (typeof step.comment !== "string") step.comment = "";
      step.forceActionArea = Boolean(step.forceActionArea);
      if (!Array.isArray(step.compiledCoils)) step.compiledCoils = [];
      if (!Array.isArray(step.conditions)) step.conditions = [];
      step.conditions = step.conditions.map(normalizeConditionElement);
      if (!step.branches) step.branches = {};
      normalizeBranches(step);
      if (step.hasConditionBox) ensureLadderStep(step);
      if (!Array.isArray(step.actions)) step.actions = [];
      step.actions.forEach((action) => {
        ensureActionOptions(action);
        if (typeof action.waitDone === "undefined") action.waitDone = true;
      });
    });
    work.libraryOpen = { ...createStationWork().libraryOpen, ...(work.libraryOpen || {}) };
    ensureStepSystemNumbers(work);
  });
}

function splitCombinedConditionActionSteps(work) {
  for (let index = 0; index < work.steps.length; index += 1) {
    const step = work.steps[index];
    if (!step?.hasConditionBox || !Array.isArray(step.actions) || !step.actions.length) continue;
    const actionStep = createStep({
      systemNo: null,
      comment: step.comment ? `${step.comment} 动作` : "",
      actions: step.actions,
      ai: step.ai || null
    });
    step.actions = [];
    step.forceActionArea = false;
    step.ai = null;
    work.steps.splice(index + 1, 0, actionStep);
    work.arrows = Array.from(new Set([
      ...work.arrows.map((arrowIndex) => (Number(arrowIndex) > index ? Number(arrowIndex) + 1 : Number(arrowIndex))),
      index + 1
    ])).filter(Number.isFinite).sort((a, b) => a - b);
    index += 1;
  }
}

function markDirty(stationId) {
  const work = getWork(stationId);
  work.aiCompleted = false;
  work.aiSummary = [];
  work.steps.forEach((step) => {
    step.ai = null;
  });
}

function updateCodeEditBadges() {
  projectData.stations.forEach((station) => {
    const edited = getWork(station.id).codeEdited;
    document.querySelectorAll(`[data-station-id="${station.id}"].station-workspace`).forEach((node) => {
      node.classList.toggle("has-code-edit", edited);
    });
  });
}

function syncCanvasNodeWidth() {
  els.stationScroller.querySelectorAll(".flow-canvas").forEach((canvas) => {
    const work = getWork(canvas.dataset.stationCanvas || getProgramStationId());
    let longest = 0;
    let widestConditionParts = 0;
    work.steps.forEach((step) => {
      step.actions.forEach((action) => {
        longest = Math.max(longest, `${action.deviceName}${action.actionLabel || ""}`.length);
      });
      if (step.hasConditionBox) {
        const ladder = ensureLadderStep(step);
        widestConditionParts = Math.max(widestConditionParts, ladder?.cols || step.conditions.length);
      }
      step.conditions.forEach((condition) => {
        longest = Math.max(longest, `${condition.name}${condition.address || ""}`.length);
      });
      Object.values(step.branches || {}).forEach((branch) => {
        ["up", "down"].forEach((lane) => {
          widestConditionParts = Math.max(widestConditionParts, getBranchConditions(branch, lane).length + step.conditions.length);
          getBranchConditions(branch, lane).forEach((condition) => {
            longest = Math.max(longest, `${condition.name}${condition.address || ""}`.length);
          });
        });
      });
    });
    const actionWidth = Math.max(330, Math.min(560, 190 + longest * 8));
    const conditionWidth = widestConditionParts
      ? Math.max(420, Math.min(980, 120 + widestConditionParts * 120))
      : actionWidth;
    canvas.style.setProperty("--node-width", `${actionWidth}px`);
    canvas.style.setProperty("--condition-node-width", `${conditionWidth}px`);
  });
}

function setActiveStation(stationId) {
  if (!getStation(stationId)) return;
  if (state.currentStationId === stationId) return;
  state.currentStationId = stationId;
  renderCodePreview();
  renderAiSummary();
  document.querySelectorAll(".station-workspace").forEach((node) => {
    node.classList.toggle("is-active-station", node.dataset.stationId === stationId);
  });
}

function setZoneStation(zone, stationId) {
  if (!getStation(stationId)) return;
  if (zone === "variable") {
    state.variableStationId = stationId;
    state.variableStationPinned = stationId !== getProgramStationId();
    editingLibraryItem = null;
  } else if (zone === "program") {
    const previousProgramId = getProgramStationId();
    state.programStationId = stationId;
    state.currentStationId = stationId;
    if (!state.variableStationPinned || state.variableStationId === previousProgramId) {
      state.variableStationId = stationId;
      state.variableStationPinned = false;
    }
    if (!state.codeStationPinned || state.codeStationId === previousProgramId) {
      state.codeStationId = stationId;
      state.codeStationPinned = false;
    }
    activeStep = null;
    activeConditionBox = null;
    activeInsert = null;
    selectedSteps = [];
    selectedCells = [];
    selectedComponent = null;
  } else if (zone === "code") {
    state.codeStationId = stationId;
    state.codeStationPinned = stationId !== getProgramStationId();
    closeCodeSuggest();
  }
}

function getVariableStationId() {
  return getStation(state.variableStationId)?.id || state.currentStationId || projectData.stations[0].id;
}

function getProgramStationId() {
  return getStation(state.programStationId)?.id || state.currentStationId || projectData.stations[0].id;
}

function getCodeStationId() {
  return getStation(state.codeStationId)?.id || state.currentStationId || projectData.stations[0].id;
}

function getStation(id) {
  return projectData.stations.find((station) => station.id === id) || projectData.stations[0];
}

function getWork(stationId) {
  if (!state.stations[stationId]) state.stations[stationId] = createStationWork();
  if (!Array.isArray(state.stations[stationId].localVariables)) state.stations[stationId].localVariables = [];
  if (!state.stations[stationId].customItems) state.stations[stationId].customItems = createStationWork().customItems;
  if (!state.stations[stationId].itemNames) state.stations[stationId].itemNames = {};
  if (!state.stations[stationId].itemComments) state.stations[stationId].itemComments = {};
  if (!state.stations[stationId].itemTypes) state.stations[stationId].itemTypes = {};
  if (!state.stations[stationId].itemTargets) state.stations[stationId].itemTargets = {};
  return state.stations[stationId];
}

function getStep(stationId, stepId) {
  return getWork(stationId).steps.find((step) => step.id === stepId);
}

function getLibraryItems(stationId, kind) {
  const station = getStation(stationId);
  const work = getWork(stationId);
  const source = {
    actuator: station.actuators,
    sensor: station.sensors,
    system: projectData.system.systemConditions,
    delay: projectData.system.timers,
    local: work.localVariables,
    global: state.globalVariables
  }[kind] || [];
  const custom = work.customItems?.[kind] || [];
  return [...source, ...custom].map((item) => applyLibraryName(stationId, kind, item));
}

function applyLibraryName(stationId, kind, item) {
  const key = `${kind}:${item.id}`;
  const work = getWork(stationId);
  const name = kind === "global" ? state.globalNames?.[key] : work.itemNames?.[key];
  const comment = kind === "global" ? state.globalComments?.[key] : work.itemComments?.[key];
  const type = kind === "global" ? state.globalTypes?.[key] : work.itemTypes?.[key];
  const targets = kind === "global" ? state.globalTargets?.[key] : work.itemTargets?.[key];
  const next = {
    ...item,
    ...(name ? { name } : {}),
    ...(comment ? { comment, address: comment } : {}),
    ...(type ? { type, valueType: type } : {}),
    ...(Array.isArray(targets) && targets.length ? { targets } : {})
  };
  if (kind === "actuator" && Array.isArray(targets) && targets.length) {
    next.actions = buildDeviceActions(next.name, next.type, targets);
  }
  return next;
}

function getMutableLibraryCollection(stationId, kind) {
  const work = getWork(stationId);
  if (kind === "local") return work.localVariables;
  if (kind === "global") return state.globalVariables;
  if (!work.customItems[kind]) work.customItems[kind] = [];
  return work.customItems[kind];
}

function createLibraryItemTemplate(kind, index) {
  if (kind === "actuator") {
    return {
      type: "cylinder",
      name: `自定义执行器${index}`,
      targets: ["初始位", "工作位"],
      actions: buildDeviceActions(`自定义执行器${index}`, "cylinder", ["初始位", "工作位"])
    };
  }
  if (kind === "delay") {
    return { name: `自定义定时器${index}`, type: "delay", defaultMs: 1000 };
  }
  const prefix = {
    sensor: "自定义传感器",
    system: "自定义系统变量",
    local: "局部变量",
    global: "全局变量"
  }[kind] || "自定义变量";
  const name = `${prefix}${index}`;
  return {
    name,
    address: kind === "local" ? `#${name}` : kind === "global" ? `GVL.${name}` : "",
    expression: normalizeName(name),
    valueType: "BOOL",
    scope: kind
  };
}

function isVariableKind(kind) {
  return ["sensor", "system", "local", "global"].includes(kind);
}

function getLibraryTypeText(kind, item) {
  if (kind === "actuator") return actuatorTypeLabel(item.type);
  if (isVariableKind(kind)) return item.valueType || item.type || "BOOL";
  if (kind === "delay") return "TIME";
  return "";
}

function actuatorTypeLabel(type) {
  return {
    cylinder: "气缸",
    axis: "轴",
    press: "压机",
    fan: "风机",
    heater: "加热",
    customActuator: "执行器"
  }[type] || type || "执行器";
}

function renderLibraryTypeEditor(kind, item) {
  if (kind === "actuator") {
    const options = [
      ["cylinder", "气缸"],
      ["axis", "轴"],
      ["press", "压机"],
      ["fan", "风机"],
      ["heater", "加热"]
    ];
    return renderInlineSelect("library-type-input", "data-library-type-input", item.type || "cylinder", options);
  }
  const value = item.valueType || item.type || "BOOL";
  return renderInlineSelect("library-type-input", "data-library-type-input", value, [
    ["BOOL", "BOOL"],
    ["INT", "INT"],
    ["DINT", "DINT"],
    ["REAL", "REAL"],
    ["TIME", "TIME"],
    ["STRING", "STRING"]
  ]);
}

function renderInlineSelect(className, dataAttr, value, options) {
  return `
    <select class="${className}" data-library-edit-input ${dataAttr}>
      ${options.map(([id, label]) => `<option value="${id}" ${id === value ? "selected" : ""}>${label}</option>`).join("")}
    </select>
  `;
}

function getTargetText(item) {
  return getActionLabels(item).join("，");
}

function getActionLabels(item) {
  if (Array.isArray(item.targets) && item.targets.length) return item.targets;
  if (Array.isArray(item.actions) && item.actions.length) return item.actions.map((action) => action.label);
  return defaultTargetsForType(item.type);
}

function splitTargets(value) {
  return String(value || "")
    .split(/[,，;；\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function defaultTargetsForType(type) {
  if (type === "axis") return ["P1安全位", "P2等待位", "P3工作位"];
  if (type === "press") return ["回原点", "取料", "压装"];
  if (type === "fan" || type === "heater") return ["启动", "停止"];
  return ["初始位", "工作位"];
}

function targetsMatchDefault(targets, type) {
  const defaults = defaultTargetsForType(type);
  return Array.isArray(targets) &&
    targets.length === defaults.length &&
    targets.every((target, index) => target === defaults[index]);
}

function buildDeviceActions(name, type = "cylinder", targets = defaultTargetsForType(type)) {
  const labels = targets.length ? targets : defaultTargetsForType(type);
  return labels.map((label, index) => {
    const id = makeActionId(label, index);
    return {
      id,
      label,
      command: `${name}.${normalizeName(label)} := TRUE`,
      done: `${name}.${normalizeName(label)}DONE`
    };
  });
}

function makeActionId(label, index) {
  const normalized = safeId(label).toLowerCase();
  return normalized || `target${index + 1}`;
}

function saveLibraryOverride(stationId, kind, id, field, value, direct) {
  if (direct) {
    if (field === "type") {
      if (kind === "actuator") {
        const oldType = direct.type;
        const oldTargets = direct.targets || getActionLabels(direct);
        direct.type = value;
        if (!Array.isArray(direct.targets) || !direct.targets.length || targetsMatchDefault(oldTargets, oldType)) {
          direct.targets = defaultTargetsForType(value);
        }
        direct.actions = buildDeviceActions(direct.name, direct.type, direct.targets);
      } else {
        direct.valueType = value;
        direct.type = value;
      }
    }
    if (field === "targets" && kind === "actuator") {
      direct.targets = value.length ? value : defaultTargetsForType(direct.type);
      direct.actions = buildDeviceActions(direct.name, direct.type, direct.targets);
    }
    return;
  }
  const key = `${kind}:${id}`;
  const bucket = kind === "global"
    ? (field === "type" ? state.globalTypes : state.globalTargets)
    : (field === "type" ? getWork(stationId).itemTypes : getWork(stationId).itemTargets);
  bucket[key] = value;
}

function bindConditionToSource(condition, kind, item) {
  const points = getConditionPoints(kind, item);
  const defaultPoint = points.find((point) => point.isDefault) || points[0];
  condition.kind = "contact";
  condition.binding = {
    kind,
    id: item.id,
    name: item.name
  };
  condition.name = item.name;
  condition.sourceId = item.id;
  condition.sourceKind = kind;
  condition.valueType = item.valueType || item.type || defaultPoint?.valueType || "BOOL";
  condition.points = points;
  condition.compareOp = defaultCompareOp(condition.valueType);
  condition.compareValue = defaultCompareValue(condition.valueType);
  if (defaultPoint) applyConditionPoint(condition, defaultPoint.id);
}

function getConditionPoints(kind, item) {
  if (kind === "actuator") return getActuatorConditionPoints(item);
  if (kind === "delay") {
    const expr = `T_${safeId(item.name)}.Q`;
    return [{ id: "q", label: "T.Q", expression: expr, address: expr, valueType: "BOOL", isDefault: true }];
  }
  const valueType = item.valueType || item.type || "BOOL";
  return [{
    id: "value",
    label: valueType === "BOOL" ? "信号" : "比较",
    expression: item.expression || normalizeName(item.name),
    address: item.address || "",
    valueType,
    isDefault: true
  }];
}

function getActuatorConditionPoints(item) {
  if (item.type === "cylinder") {
    const home = item.actions?.[0] || { label: "初始位", command: `${item.name}.初始位 := TRUE`, done: `${item.name}.初始位DONE` };
    const work = item.actions?.[1] || { label: "工作位", command: `${item.name}.工作位 := TRUE`, done: `${item.name}.工作位DONE` };
    return [
      { id: "homeOut", label: "初始位输出", expression: commandExpression(home.command), address: commandExpression(home.command), valueType: "BOOL" },
      { id: "workOut", label: "工作位输出", expression: commandExpression(work.command), address: commandExpression(work.command), valueType: "BOOL" },
      { id: "homeDone", label: "初始位到达", expression: home.done || `${item.name}.初始位DONE`, address: home.done || "", valueType: "BOOL", isDefault: true },
      { id: "workDone", label: "工作位到达", expression: work.done || `${item.name}.工作位DONE`, address: work.done || "", valueType: "BOOL" }
    ];
  }
  if (item.type === "axis") {
    return (item.actions || []).map((action, index) => ({
      id: `${action.id || index}_done`,
      label: `${action.label}到达`,
      expression: action.done || `${item.name}.${normalizeName(action.label)}到达`,
      address: action.done || "",
      valueType: "BOOL",
      isDefault: index === 0
    }));
  }
  const points = [];
  (item.actions || []).forEach((action, index) => {
    const outExpr = commandExpression(action.command);
    points.push({
      id: `${action.id || index}_out`,
      label: `${action.label}输出`,
      expression: outExpr,
      address: outExpr,
      valueType: "BOOL"
    });
    points.push({
      id: `${action.id || index}_done`,
      label: `${action.label}完成`,
      expression: action.done && action.done !== "TRUE" ? action.done : `${item.name}.${normalizeName(action.label)}完成`,
      address: action.done && action.done !== "TRUE" ? action.done : "",
      valueType: "BOOL",
      isDefault: index === 0
    });
  });
  return points.length ? points : [{
    id: "done",
    label: "完成",
    expression: `${item.name}.DONE`,
    address: "",
    valueType: "BOOL",
    isDefault: true
  }];
}

function commandExpression(command) {
  return String(command || "").split(":=")[0].replace(/;$/, "").trim() || "TRUE";
}

function applyConditionPoint(condition, pointId) {
  const point = condition.points?.find((candidate) => candidate.id === pointId) || condition.points?.[0];
  if (!point) return;
  condition.pointId = point.id;
  condition.pointLabel = point.label;
  condition.valueType = point.valueType || condition.valueType || "BOOL";
  condition.address = point.address || point.label || "";
  condition.expression = conditionExpression(condition, point.expression);
}

function conditionExpression(condition, baseExpression = null) {
  const base = baseExpression || condition.points?.find((point) => point.id === condition.pointId)?.expression || condition.expression || "";
  if (!base) return "";
  if (!needsCompare(condition)) return base;
  return `${base} ${condition.compareOp || defaultCompareOp(condition.valueType)} ${formatCompareValue(condition)}`;
}

function conditionDetailText(condition) {
  if (!condition.binding) return "";
  if (needsCompare(condition)) return `${condition.pointLabel || "比较"} ${condition.compareOp} ${condition.compareValue}`;
  return condition.pointLabel || condition.address || "";
}

function contactSymbol(contact) {
  if (contact === "NC") return "|/|";
  if (contact === "RISING") return "|P|";
  if (contact === "FALLING") return "|N|";
  return "| |";
}

function getConditionSelectablePoints(condition) {
  return Array.isArray(condition.points) ? condition.points : [];
}

function needsCompare(condition) {
  return condition.binding && !["BOOL", "BOOLEAN", "delay", "cylinder", "axis", "press", "fan", "heater"].includes(condition.valueType || "BOOL");
}

function compareOpsForType(type) {
  if (type === "STRING") return ["=", "<>"];
  if (["INT", "DINT", "REAL", "TIME"].includes(type)) return ["=", "<>", ">", ">=", "<", "<="];
  return [];
}

function defaultCompareOp(type) {
  if (type === "STRING") return "<>";
  if (["INT", "DINT", "REAL", "TIME"].includes(type)) return ">";
  return "";
}

function defaultCompareValue(type) {
  if (type === "STRING") return "''";
  if (["INT", "DINT", "REAL", "TIME"].includes(type)) return "0";
  return "";
}

function formatCompareValue(condition) {
  const value = String(condition.compareValue ?? defaultCompareValue(condition.valueType));
  if (condition.valueType === "STRING" && !(value.startsWith("'") && value.endsWith("'"))) return `'${value}'`;
  return value;
}

function findLibraryItem(stationId, kind, id) {
  return getLibraryItems(stationId, kind).find((item) => item.id === id);
}

function findDevice(deviceId) {
  for (const station of projectData.stations) {
    const device = station.actuators.find((item) => item.id === deviceId);
    if (device) return device;
  }
  return null;
}

function ensureActionOptions(action) {
  if (action.type === "delay") return;
  if (Array.isArray(action.options) && action.options.length) return;
  const device = findDevice(action.deviceId);
  if (!device) return;
  action.options = device.actions.map((item) => ({
    id: item.id,
    label: item.label,
    command: item.command,
    done: item.done
  }));
}

function toLogicExpression(conditions) {
  return conditions
    .filter((condition) => ["NO", "NC", "RISING", "FALLING"].includes(condition.value || condition.contact))
    .map((condition) => {
      const expr = condition.expression || (condition.binding ? normalizeName(condition.name) : "FALSE /* 未绑定触点 */");
      const contact = condition.value || condition.contact;
      if (contact === "NC") return expr.startsWith("NOT ") ? expr : `NOT (${expr})`;
      if (contact === "RISING") return `R_TRIG_${safeId(condition.id)}(${expr}).Q`;
      if (contact === "FALLING") return `F_TRIG_${safeId(condition.id)}(${expr}).Q`;
      return expr;
    })
    .join(" AND ");
}

function collectStepConditions(step) {
  if (step.hasConditionBox) {
    const ladder = ensureLadderStep(step);
    if (ladder?.cells) {
      return ladder.cells
        .filter((cell) => cell.type === "square" && ["NO", "NC", "RISING", "FALLING"].includes(cell.value) && cell.row === LADDER_MAIN_ROW)
        .sort((a, b) => a.col - b.col);
    }
  }
  const conditions = [...(step.conditions || [])];
  Object.values(step.branches || {}).forEach((branch) => {
    ["up", "down"].forEach((lane) => {
      conditions.push(...getBranchConditions(branch, lane));
    });
  });
  return conditions;
}

function defaultTimeout(type) {
  if (type === "axis") return 8000;
  if (type === "press") return 10000;
  if (type === "heater") return 30000;
  if (type === "delay") return 0;
  return 5000;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    els.clipboardFallback.value = text;
    els.clipboardFallback.select();
    document.execCommand("copy");
  }
}
