function newProject() {
  if (!confirm("新建项目会清空当前编辑内容，是否继续？")) return;
  replaceProjectData(DEFAULT_PROJECT_DATA);
  state = createDefaultState();
  resetTransientUiState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll({ preserveScroll: false });
  setSummaryMessage("已新建空项目。");
}

function downloadProjectFile() {
  const payload = createProjectPayload();
  const date = new Date().toISOString().slice(0, 10);
  downloadTextFile(`PLCide-${date}.plcide.json`, JSON.stringify(payload, null, 2), "application/json");
  setSummaryMessage("项目文件已导出，包含工站、变量、程序流、布局和代码编辑内容。");
}

function createProjectPayload() {
  return {
    fileType: PROJECT_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    projectData: JSON.parse(JSON.stringify(projectData)),
    state: JSON.parse(JSON.stringify(state))
  };
}

function handleProjectFileOpen(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  readFileAsText(file)
    .then((text) => {
      const payload = JSON.parse(text);
      loadProjectPayload(payload);
      setSummaryMessage(`已打开项目：${file.name}`);
    })
    .catch((error) => {
      console.error(error);
      setSummaryMessage("项目文件打开失败，请确认是 PLCide 保存的 JSON 项目。");
    });
}

function loadProjectPayload(payload) {
  const nextProjectData = payload?.projectData || DEFAULT_PROJECT_DATA;
  const nextState = payload?.state || payload;
  if (!nextState || typeof nextState !== "object") throw new Error("Invalid project file");
  replaceProjectData(nextProjectData);
  state = { ...createDefaultState(), ...nextState };
  hydrateState();
  resetTransientUiState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll({ preserveScroll: false });
}

function replaceProjectData(nextProjectData) {
  const clean = JSON.parse(JSON.stringify(nextProjectData || DEFAULT_PROJECT_DATA));
  projectData.system = clean.system || JSON.parse(JSON.stringify(DEFAULT_PROJECT_DATA.system));
  projectData.stations = Array.isArray(clean.stations) && clean.stations.length
    ? clean.stations
    : JSON.parse(JSON.stringify(DEFAULT_PROJECT_DATA.stations));
}

function resetTransientUiState() {
  activeStep = null;
  activeConditionBox = null;
  activeInsert = null;
  selectedSteps = [];
  selectedCells = [];
  copiedSteps = [];
  selectedComponent = null;
  editingLibraryItem = null;
  activeTargetEditor = null;
  closeTargetEditor();
  closeCodeSuggest();
}

function downloadLocalProjectFile() {
  downloadProjectFile();
}

function downloadTextFile(filename, content, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsText(file, "utf-8");
  });
}

function exportVariablesExcel() {
  const rows = getVariableExportRows();
  const headers = getVariableExcelHeaders();
  const table = [
    `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`,
    ...rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(row[header] || "")}</td>`).join("")}</tr>`)
  ].join("\n");
  const html = `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="ProgId" content="Excel.Sheet" />
  <meta name="Generator" content="${VARIABLE_EXCEL_VERSION}" />
  <style>
    table { border-collapse: collapse; }
    th, td { border: 1px solid #8ea7bf; padding: 4px 8px; mso-number-format:"\\@"; }
    th { background: #eaf3ff; font-weight: 700; }
  </style>
</head>
<body>
  <table data-version="${VARIABLE_EXCEL_VERSION}">
    ${table}
  </table>
</body>
</html>`;
  const date = new Date().toISOString().slice(0, 10);
  downloadTextFile(`PLCide-variables-${date}.xls`, html, "application/vnd.ms-excel;charset=utf-8");
  setSummaryMessage(`已导出 ${rows.length} 条变量到 Excel。`);
}

function getVariableExcelHeaders() {
  return ["工站ID", "工站名称", "类别", "变量ID", "名称", "类型", "地址/注释", "表达式", "目标列表", "来源"];
}

function getVariableExportRows() {
  const rows = [];
  projectData.stations.forEach((station) => {
    ["actuator", "sensor", "system", "delay", "local"].forEach((kind) => {
      getLibraryItems(station.id, kind).forEach((item) => {
        rows.push(formatVariableExcelRow(station, kind, item));
      });
    });
  });
  state.globalVariables.forEach((item) => {
    rows.push(formatVariableExcelRow({ id: "GLOBAL", name: "全局变量" }, "global", applyLibraryName(projectData.stations[0].id, "global", item)));
  });
  return rows;
}

function formatVariableExcelRow(station, kind, item) {
  return {
    "工站ID": station.id,
    "工站名称": station.name,
    "类别": kind,
    "变量ID": item.id || "",
    "名称": item.name || "",
    "类型": getLibraryTypeText(kind, item),
    "地址/注释": kind === "actuator" ? "" : (item.comment || item.address || ""),
    "表达式": item.expression || "",
    "目标列表": kind === "actuator" ? getActionLabels(item).join("，") : "",
    "来源": getVariableSource(station.id, kind, item.id)
  };
}

function getVariableSource(stationId, kind, id) {
  if (kind === "global") return "global";
  if (kind === "local") return "local";
  if (getWork(stationId).customItems?.[kind]?.some((item) => item.id === id)) return "custom";
  return "base";
}

function handleVariableExcelImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  readFileAsText(file)
    .then((text) => {
      if (text.startsWith("PK")) throw new Error("XLSX is not supported");
      const rows = parseVariableExcelText(text);
      const count = importVariableRows(rows);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      renderAll();
      setSummaryMessage(`已从 Excel 导入 ${count} 条变量。`);
    })
    .catch((error) => {
      console.error(error);
      setSummaryMessage("变量导入失败。请使用本软件导出的 .xls 变量表，或包含相同表头的 CSV。");
    });
}

function parseVariableExcelText(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("<") || /<table[\s>]/i.test(trimmed)) return parseVariableHtmlTable(trimmed);
  return parseCsvVariableTable(trimmed);
}

function parseVariableHtmlTable(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return [];
  const matrix = [...table.querySelectorAll("tr")]
    .map((tr) => [...tr.children].map((cell) => cell.textContent.trim()));
  return variableMatrixToRows(matrix);
}

function parseCsvVariableTable(csv) {
  return variableMatrixToRows(parseCsvMatrix(csv));
}

function variableMatrixToRows(matrix) {
  const [headers = [], ...body] = matrix.filter((row) => row.some(Boolean));
  if (!headers.length) return [];
  return body.map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      item[normalizeVariableHeader(header)] = row[index] || "";
    });
    return item;
  });
}

function normalizeVariableHeader(header) {
  const text = String(header || "").trim().toLowerCase();
  return {
    "工站id": "stationId",
    "stationid": "stationId",
    "station id": "stationId",
    "工站名称": "stationName",
    "类别": "kind",
    "类型": "type",
    "变量id": "id",
    "variableid": "id",
    "variable id": "id",
    "名称": "name",
    "变量名称": "name",
    "地址/注释": "meta",
    "地址": "meta",
    "注释": "meta",
    "表达式": "expression",
    "目标列表": "targets",
    "目标": "targets",
    "来源": "source"
  }[text] || text;
}

function parseCsvMatrix(csv) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        value += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }
    if (char === "\"") quoted = true;
    else if (char === ",") {
      row.push(value.trim());
      value = "";
    } else if (char === "\n") {
      row.push(value.trim());
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }
  row.push(value.trim());
  rows.push(row);
  return rows;
}

function importVariableRows(rows) {
  let count = 0;
  rows.forEach((row) => {
    const normalized = normalizeVariableRow(row);
    if (!normalized.name) return;
    upsertVariableFromImport(normalized);
    count += 1;
  });
  return count;
}

function normalizeVariableRow(row) {
  const kind = normalizeVariableKind(row.kind);
  const station = kind === "global" ? projectData.stations[0] : findStationForImport(row.stationId, row.stationName);
  const id = String(row.id || "").trim() || makeImportedVariableId(kind, row.name);
  return {
    stationId: station.id,
    kind,
    id,
    name: String(row.name || "").trim(),
    type: String(row.type || "").trim(),
    meta: String(row.meta || "").trim(),
    expression: String(row.expression || "").trim(),
    targets: splitTargets(row.targets)
  };
}

function normalizeVariableKind(kind) {
  const text = String(kind || "").trim().toLowerCase();
  return {
    "执行器": "actuator",
    "actuator": "actuator",
    "传感器": "sensor",
    "sensor": "sensor",
    "系统变量": "system",
    "system": "system",
    "定时器": "delay",
    "timer": "delay",
    "delay": "delay",
    "局部变量": "local",
    "local": "local",
    "全局变量": "global",
    "global": "global"
  }[text] || "local";
}

function findStationForImport(stationId, stationName) {
  return projectData.stations.find((station) => station.id === stationId) ||
    projectData.stations.find((station) => station.name === stationName) ||
    getStation(getVariableStationId());
}

function makeImportedVariableId(kind, name) {
  return `${kind}_${safeId(name) || uid("import")}`;
}

function upsertVariableFromImport(row) {
  const stationId = row.stationId;
  const kind = row.kind;
  const direct = getMutableLibraryCollection(stationId, kind).find((item) => item.id === row.id);
  const existing = findLibraryItem(stationId, kind, row.id);
  const target = existing ? direct : createImportedLibraryItem(row);
  if (!existing && target) getMutableLibraryCollection(stationId, kind).push(target);
  applyImportedVariableFields(stationId, kind, row, target);
  if (kind === "actuator" && row.targets.length) {
    updateActionsForEditedTargets(stationId, row.id, row.targets);
  }
  if (kind !== "global") markDirty(stationId);
}

function createImportedLibraryItem(row) {
  if (row.kind === "actuator") {
    const type = row.type || "cylinder";
    const targets = row.targets.length ? row.targets : defaultTargetsForType(type);
    return {
      id: row.id,
      type,
      name: row.name,
      targets,
      actions: buildDeviceActions(row.name, type, targets)
    };
  }
  if (row.kind === "delay") {
    return { id: row.id, name: row.name, type: "delay", defaultMs: 1000, comment: row.meta };
  }
  const type = row.type || "BOOL";
  return {
    id: row.id,
    name: row.name,
    address: row.meta,
    comment: row.meta,
    expression: row.expression || normalizeName(row.name),
    type,
    valueType: type,
    scope: row.kind
  };
}

function applyImportedVariableFields(stationId, kind, row, direct) {
  if (direct) {
    direct.name = row.name;
    if (row.meta) {
      direct.comment = row.meta;
      direct.address = row.meta;
    }
    if (row.expression) direct.expression = row.expression;
    if (row.type && kind !== "delay") saveLibraryOverride(stationId, kind, row.id, "type", row.type, direct);
    if (kind === "actuator" && row.targets.length) saveLibraryOverride(stationId, kind, row.id, "targets", row.targets, direct);
    return;
  }
  const key = `${kind}:${row.id}`;
  const work = getWork(stationId);
  if (kind === "global") {
    state.globalNames[key] = row.name;
    if (row.meta) state.globalComments[key] = row.meta;
    if (row.type) state.globalTypes[key] = row.type;
  } else {
    work.itemNames[key] = row.name;
    if (row.meta) work.itemComments[key] = row.meta;
    if (row.type && kind !== "delay") work.itemTypes[key] = row.type;
    if (kind === "actuator" && row.targets.length) work.itemTargets[key] = row.targets;
  }
}
