const MODELER_SECTIONS = [
  ["project", "项目名称"],
  ["stations", "站名称"],
  ["classes", "执行器类"],
  ["instances", "执行器实例"],
  ["sensors", "传感器"],
  ["timers", "定时器"],
  ["system", "系统变量"],
  ["local", "局部变量"],
  ["global", "全局变量"]
];

let modelerState = null;
let modelerActiveSection = "project";

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("modelerBtn")?.addEventListener("click", openModeler);
});

function openModeler() {
  modelerState = createModelerFromCurrentProject();
  modelerActiveSection = "project";
  renderModeler();
}

function closeModeler() {
  const modal = document.getElementById("modelerModal");
  if (modal) modal.hidden = true;
}

function createModelerFromCurrentProject() {
  const model = {
    projectName: projectData.name || "热套压机项目",
    stations: projectData.stations.map((station) => ({ id: station.id, name: station.name })),
    actuatorClasses: createDefaultActuatorClasses(),
    actuatorInstances: [],
    sensors: [],
    timers: [],
    systemVariables: projectData.system.systemConditions.map((item) => normalizeModelVariable(item, "")),
    localVariables: [],
    globalVariables: state.globalVariables.map((item) => normalizeModelVariable(applyLibraryName(projectData.stations[0].id, "global", item), "GLOBAL"))
  };

  projectData.stations.forEach((station) => {
    station.actuators.forEach((item) => {
      if (!model.actuatorClasses.some((klass) => klass.id === item.type)) {
        model.actuatorClasses.push(createActuatorClassFromInstance(item));
      }
      model.actuatorInstances.push({
        stationId: station.id,
        classId: item.type || "customActuator",
        id: item.id,
        name: item.name,
        targets: getActionLabels(item).join("，"),
        executeTemplate: "",
        doneTemplate: ""
      });
    });
    station.sensors.forEach((item) => model.sensors.push(normalizeModelVariable(item, station.id)));
    const work = getWork(station.id);
    const stationTimers = (work.customItems?.delay || []).map((item) => normalizeModelTimer(item, station.id));
    model.timers.push(...ensureDefaultStationTimers(station.id, stationTimers));
    work.localVariables.forEach((item) => model.localVariables.push(normalizeModelVariable(item, station.id)));
  });
  return model;
}

function createDefaultActuatorClasses() {
  return [
    {
      id: "cylinder",
      name: "气缸",
      defaultTargets: "初始位，工作位",
      structTemplate: "初始位 : BOOL\n工作位 : BOOL\n初始位DONE : BOOL\n工作位DONE : BOOL",
      executeTemplate: "{实例名}.{目标名} := TRUE",
      doneTemplate: "{实例名}.{目标名}DONE"
    },
    {
      id: "axis",
      name: "轴",
      defaultTargets: "P1安全位，P2等待位，P3工作位",
      structTemplate: "GO : ARRAY[1..目标数量] OF BOOL\nDONE : ARRAY[1..目标数量] OF BOOL",
      executeTemplate: "{实例名}.GO.{目标序号} := TRUE",
      doneTemplate: "{实例名}.DONE.{目标序号}"
    }
  ];
}

function createActuatorClassFromInstance(item) {
  const type = item.type || "customActuator";
  return {
    id: type,
    name: actuatorTypeLabel(type),
    defaultTargets: getActionLabels(item).join("，") || "动作1",
    structTemplate: "REQ : BOOL\nDONE : BOOL",
    executeTemplate: "{实例名}.{目标名} := TRUE",
    doneTemplate: "{实例名}.{目标名}DONE"
  };
}

function normalizeModelVariable(item, stationId) {
  return {
    stationId,
    id: item.id || uid("var"),
    name: item.name || "",
    type: item.valueType || item.type || "BOOL",
    address: item.address || item.comment || "",
    expression: item.expression || normalizeName(item.name || ""),
    comment: item.comment || ""
  };
}

function normalizeModelTimer(item, stationId) {
  return {
    stationId,
    id: item.id || uid("timer"),
    name: item.name || "定时器",
    type: "delay",
    defaultMs: Number(item.defaultMs) || 1000
  };
}

function createDefaultStationTimers(stationId) {
  const rows = [{ stationId, id: `${stationId}_flowTimer`, name: "流程定时器", type: "delay", defaultMs: 1000 }];
  for (let index = 1; index <= 10; index += 1) {
    rows.push({ stationId, id: `${stationId}_alarmTimer${index}`, name: `报警定时器${index}`, type: "delay", defaultMs: 5000 });
  }
  return rows;
}

function ensureDefaultStationTimers(stationId, timers = []) {
  const rows = [...timers];
  createDefaultStationTimers(stationId).forEach((timer) => {
    if (!rows.some((row) => row.id === timer.id)) rows.push(timer);
  });
  return rows;
}

function renderModeler() {
  const modal = document.getElementById("modelerModal");
  if (!modal || !modelerState) return;
  modal.hidden = false;
  modal.innerHTML = `
    <section class="modeler-modal" role="dialog" aria-modal="true" aria-labelledby="modelerTitle">
      <header class="modeler-head">
        <div>
          <h2 id="modelerTitle">参数建模</h2>
          <p>按项目结构配置参数，校验通过后导入到 IDE 项目。</p>
        </div>
        <button class="secondary small" type="button" data-modeler-close>关闭</button>
      </header>
      <div class="modeler-body">
        <nav class="modeler-nav">
          ${MODELER_SECTIONS.map(([id, label]) => `<button type="button" class="${id === modelerActiveSection ? "is-active" : ""}" data-modeler-section="${id}">${escapeHtml(label)}</button>`).join("")}
        </nav>
        <main class="modeler-content">${renderModelerSection()}</main>
      </div>
      <footer class="modeler-foot">
        <div class="modeler-status" id="modelerStatus">未校验</div>
        <div class="modeler-actions">
          <button class="secondary" type="button" data-modeler-validate>校验</button>
          <button class="secondary" type="button" data-modeler-export>生成标准Excel</button>
          <button class="secondary primary-action" type="button" data-modeler-import>导入到IDE项目</button>
          <button class="secondary" type="button" data-modeler-close>关闭</button>
        </div>
      </footer>
    </section>
  `;
  bindModelerModal(modal);
}

function bindModelerModal(modal) {
  modal.querySelectorAll("[data-modeler-section]").forEach((button) => {
    button.addEventListener("click", () => {
      modelerActiveSection = button.dataset.modelerSection;
      renderModeler();
    });
  });
  modal.querySelectorAll("[data-modeler-close]").forEach((button) => button.addEventListener("click", closeModeler));
  modal.querySelector("[data-modeler-validate]")?.addEventListener("click", () => showModelerValidation(validateModelerModel()));
  modal.querySelector("[data-modeler-export]")?.addEventListener("click", exportModelerExcel);
  modal.querySelector("[data-modeler-import]")?.addEventListener("click", importModelerToIde);
  modal.querySelectorAll("[data-modeler-field]").forEach((field) => {
    field.addEventListener("input", handleModelerInput);
    field.addEventListener("change", handleModelerInput);
  });
  modal.querySelectorAll("[data-modeler-add]").forEach((button) => button.addEventListener("click", () => addModelerRow(button.dataset.modelerAdd)));
  modal.querySelectorAll("[data-modeler-delete]").forEach((button) => button.addEventListener("click", () => deleteModelerRow(button.dataset.modelerDelete, Number(button.dataset.index))));
}

function renderModelerSection() {
  if (modelerActiveSection === "project") return renderProjectSection();
  if (modelerActiveSection === "stations") return renderStationsSection();
  if (modelerActiveSection === "classes") return renderClassesSection();
  if (modelerActiveSection === "instances") return renderInstancesSection();
  if (modelerActiveSection === "sensors") return renderVariableSection("传感器", "sensors", true);
  if (modelerActiveSection === "timers") return renderTimersSection();
  if (modelerActiveSection === "system") return renderVariableSection("系统变量", "systemVariables", false);
  if (modelerActiveSection === "local") return renderVariableSection("局部变量", "localVariables", true);
  return renderVariableSection("全局变量", "globalVariables", false);
}

function renderProjectSection() {
  return `
    <div class="modeler-section-head"><h3>项目名称</h3></div>
    <div class="modeler-form-grid">
      ${renderModelerField("项目名称", "projectName", modelerState.projectName, "input", "", "")}
    </div>
  `;
}

function renderStationsSection() {
  return renderModelerTable("站名称", "stations", [
    ["id", "站ID", "input"],
    ["name", "站名称", "input"]
  ]);
}

function renderClassesSection() {
  return renderModelerTable("执行器类", "actuatorClasses", [
    ["id", "类ID", "input"],
    ["name", "类名称", "input"],
    ["defaultTargets", "默认目标列表", "textarea"],
    ["structTemplate", "结构体内容", "textarea"],
    ["executeTemplate", "执行范例", "textarea"],
    ["doneTemplate", "完成判断范例", "textarea"]
  ]);
}

function renderInstancesSection() {
  return renderModelerTable("执行器实例", "actuatorInstances", [
    ["stationId", "所属站", "station"],
    ["classId", "执行器类", "class"],
    ["id", "实例ID", "input"],
    ["name", "实例名", "input"],
    ["targets", "目标列表", "textarea"],
    ["executeTemplate", "执行范例覆盖", "textarea"],
    ["doneTemplate", "完成判断覆盖", "textarea"]
  ]);
}

function renderVariableSection(title, collection, withStation) {
  const columns = [
    ...(withStation ? [["stationId", "所属站", "station"]] : []),
    ["id", "变量ID", "input"],
    ["name", "名称", "input"],
    ["type", "类型", "type"],
    ["address", "地址", "input"],
    ["expression", "表达式", "input"],
    ["comment", "备注", "input"]
  ];
  return renderModelerTable(title, collection, columns);
}

function renderTimersSection() {
  return renderModelerTable("定时器", "timers", [
    ["stationId", "所属站", "station"],
    ["id", "定时器ID", "input"],
    ["name", "名称", "input"],
    ["defaultMs", "默认时间ms", "number"]
  ]);
}

function renderModelerTable(title, collection, columns) {
  const rows = modelerState[collection] || [];
  return `
    <div class="modeler-section-head">
      <h3>${escapeHtml(title)}</h3>
      <div class="modeler-actions">
        <button class="secondary small" type="button" data-modeler-add="${collection}">添加</button>
      </div>
    </div>
    <div class="modeler-table-wrap">
      <table class="modeler-table">
        <thead>
          <tr>${columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("")}<th>操作</th></tr>
        </thead>
        <tbody>
          ${rows.map((row, index) => `
            <tr>
              ${columns.map(([field, , type]) => `<td class="modeler-cell">${renderModelerCell(collection, index, field, type, row[field])}</td>`).join("")}
              <td><button class="modeler-delete" type="button" data-modeler-delete="${collection}" data-index="${index}">删除</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <div class="modeler-alerts" id="modelerSectionAlerts"></div>
  `;
}

function renderModelerField(label, field, value, type, collection, index) {
  return `
    <div class="modeler-field">
      <label>${escapeHtml(label)}</label>
      <input data-modeler-field="${field}" data-collection="${collection}" data-index="${index}" value="${escapeHtml(value)}" />
    </div>
  `;
}

function renderModelerCell(collection, index, field, type, value) {
  const attr = `data-modeler-field="${field}" data-collection="${collection}" data-index="${index}"`;
  if (type === "textarea") return `<textarea ${attr}>${escapeHtml(value || "")}</textarea>`;
  if (type === "number") return `<input type="number" ${attr} value="${escapeHtml(value || "")}" />`;
  if (type === "station") {
    return `<select ${attr}>${modelerState.stations.map((station) => `<option value="${escapeHtml(station.id)}" ${station.id === value ? "selected" : ""}>${escapeHtml(station.name || station.id)}</option>`).join("")}</select>`;
  }
  if (type === "class") {
    return `<select ${attr}>${modelerState.actuatorClasses.map((klass) => `<option value="${escapeHtml(klass.id)}" ${klass.id === value ? "selected" : ""}>${escapeHtml(klass.name || klass.id)}</option>`).join("")}</select>`;
  }
  if (type === "type") {
    return `<select ${attr}>${["BOOL", "INT", "DINT", "REAL", "TIME", "STRING"].map((item) => `<option value="${item}" ${item === value ? "selected" : ""}>${item}</option>`).join("")}</select>`;
  }
  return `<input ${attr} value="${escapeHtml(value || "")}" />`;
}

function handleModelerInput(event) {
  const field = event.target.dataset.modelerField;
  const collection = event.target.dataset.collection;
  const index = Number(event.target.dataset.index);
  const value = event.target.value;
  if (!collection) {
    modelerState[field] = value;
    return;
  }
  if (modelerState[collection]?.[index]) {
    modelerState[collection][index][field] = field === "defaultMs" ? Number(value) || 0 : value;
  }
}

function addModelerRow(collection) {
  if (collection === "stations") {
    const index = modelerState.stations.length + 1;
    const id = `station${index}`;
    modelerState.stations.push({ id, name: `站${index}` });
    modelerState.timers.push(...createDefaultStationTimers(id));
  } else if (collection === "actuatorClasses") {
    modelerState.actuatorClasses.push({
      id: `custom${modelerState.actuatorClasses.length + 1}`,
      name: "自定义执行器",
      defaultTargets: "动作1，动作2",
      structTemplate: "REQ : BOOL\nDONE : BOOL",
      executeTemplate: "{实例名}.{目标名} := TRUE",
      doneTemplate: "{实例名}.{目标名}DONE"
    });
  } else if (collection === "actuatorInstances") {
    const stationId = modelerState.stations[0]?.id || "station1";
    const klass = modelerState.actuatorClasses[0] || createDefaultActuatorClasses()[0];
    modelerState.actuatorInstances.push({
      stationId,
      classId: klass.id,
      id: `actuator_${uid("item")}`,
      name: "新执行器",
      targets: klass.defaultTargets,
      executeTemplate: "",
      doneTemplate: ""
    });
  } else if (collection === "timers") {
    modelerState.timers.push({ stationId: modelerState.stations[0]?.id || "", id: `timer_${uid("item")}`, name: "新定时器", defaultMs: 1000 });
  } else {
    modelerState[collection].push({
      stationId: collection === "systemVariables" || collection === "globalVariables" ? "" : (modelerState.stations[0]?.id || ""),
      id: `var_${uid("item")}`,
      name: "新变量",
      type: "BOOL",
      address: "",
      expression: "NewVar",
      comment: ""
    });
  }
  renderModeler();
}

function deleteModelerRow(collection, index) {
  modelerState[collection].splice(index, 1);
  renderModeler();
}

function validateModelerModel() {
  const errors = [];
  if (!modelerState.projectName.trim()) errors.push("项目名称不能为空。");
  validateUniqueRows(errors, modelerState.stations, "站", "id", "站ID");
  validateUniqueRows(errors, modelerState.stations, "站", "name", "站名称");
  validateUniqueRows(errors, modelerState.actuatorClasses, "执行器类", "id", "类ID");

  modelerState.actuatorClasses.forEach((klass, index) => {
    const label = `执行器类第 ${index + 1} 行`;
    if (!klass.id || !klass.name) errors.push(`${label}: 类ID和类名称不能为空。`);
    if (!splitTargets(klass.defaultTargets).length) errors.push(`${label}: 默认目标列表不能为空。`);
    if (!String(klass.executeTemplate || "").includes("{实例名}")) errors.push(`${label}: 执行范例必须包含 {实例名}。`);
    if (!String(klass.doneTemplate || "").includes("{实例名}")) errors.push(`${label}: 完成判断范例必须包含 {实例名}。`);
  });

  validateEntityRows(errors, modelerState.actuatorInstances, "执行器实例", true, true);
  modelerState.actuatorInstances.forEach((item, index) => {
    if (!modelerState.actuatorClasses.some((klass) => klass.id === item.classId)) errors.push(`执行器实例第 ${index + 1} 行: 引用的执行器类不存在。`);
    if (!splitTargets(item.targets).length) errors.push(`执行器实例第 ${index + 1} 行: 目标列表不能为空。`);
  });

  validateEntityRows(errors, modelerState.sensors, "传感器", true, false);
  validateEntityRows(errors, modelerState.timers, "定时器", true, false);
  validateEntityRows(errors, modelerState.systemVariables, "系统变量", false, false);
  validateEntityRows(errors, modelerState.localVariables, "局部变量", true, false);
  validateEntityRows(errors, modelerState.globalVariables, "全局变量", false, false);
  return errors;
}

function validateUniqueRows(errors, rows, label, field, fieldLabel) {
  const seen = new Map();
  rows.forEach((row, index) => {
    const value = String(row[field] || "").trim();
    if (!value) {
      errors.push(`${label}第 ${index + 1} 行: ${fieldLabel}不能为空。`);
      return;
    }
    if (seen.has(value)) errors.push(`${label}第 ${index + 1} 行: ${fieldLabel}重复 (${value})。`);
    seen.set(value, index);
  });
}

function validateEntityRows(errors, rows, label, needsStation, needsClass) {
  const idSeen = new Set();
  const nameSeen = new Set();
  rows.forEach((row, index) => {
    const prefix = `${label}第 ${index + 1} 行`;
    if (needsStation && !modelerState.stations.some((station) => station.id === row.stationId)) errors.push(`${prefix}: 所属站不存在。`);
    if (needsClass && !row.classId) errors.push(`${prefix}: 执行器类不能为空。`);
    if (!row.id) errors.push(`${prefix}: ID不能为空。`);
    if (!row.name) errors.push(`${prefix}: 名称不能为空。`);
    const scope = `${row.stationId || "GLOBAL"}:${row.id}`;
    const nameScope = `${row.stationId || "GLOBAL"}:${row.name}`;
    if (idSeen.has(scope)) errors.push(`${prefix}: ID重复 (${row.id})。`);
    if (nameSeen.has(nameScope)) errors.push(`${prefix}: 名称重复 (${row.name})。`);
    idSeen.add(scope);
    nameSeen.add(nameScope);
  });
}

function showModelerValidation(errors) {
  const status = document.getElementById("modelerStatus");
  if (!status) return;
  if (!errors.length) {
    status.innerHTML = `<span class="modeler-alerts"><span class="ok">校验通过，可以导入 IDE 项目。</span></span>`;
    return;
  }
  status.innerHTML = `<div class="modeler-alerts">${errors.slice(0, 8).map((item) => `<span class="error">${escapeHtml(item)}</span>`).join("")}${errors.length > 8 ? `<span class="error">还有 ${errors.length - 8} 个问题...</span>` : ""}</div>`;
}

function importModelerToIde() {
  const errors = validateModelerModel();
  if (errors.length) {
    showModelerValidation(errors);
    return;
  }
  const next = buildProjectFromModeler();
  replaceProjectData(next.projectData);
  state = next.state;
  hydrateState();
  resetTransientUiState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll({ preserveScroll: false });
  closeModeler();
  setSummaryMessage("参数建模已导入 IDE 项目。");
}

function buildProjectFromModeler() {
  const nextProjectData = {
    name: modelerState.projectName,
    system: {
      id: "system",
      name: "系统站",
      systemConditions: modelerState.systemVariables.map(toProjectVariable),
      timers: []
    },
    stations: modelerState.stations.map((station) => ({
      id: station.id,
      name: station.name,
      actuators: modelerState.actuatorInstances
        .filter((item) => item.stationId === station.id)
        .map(toProjectActuator),
      sensors: modelerState.sensors
        .filter((item) => item.stationId === station.id)
        .map(toProjectVariable)
    }))
  };
  replaceProjectData(nextProjectData);
  const nextState = createDefaultState();
  modelerState.stations.forEach((station) => {
    const work = nextState.stations[station.id] || createStationWork();
    work.customItems.delay = ensureDefaultStationTimers(station.id, modelerState.timers
      .filter((timer) => timer.stationId === station.id)
      .map((timer) => ({ id: timer.id, name: timer.name, type: "delay", defaultMs: Number(timer.defaultMs) || 1000 })));
    work.localVariables = modelerState.localVariables
      .filter((item) => item.stationId === station.id)
      .map(toProjectVariable);
    nextState.stations[station.id] = work;
  });
  nextState.globalVariables = modelerState.globalVariables.map(toProjectVariable);
  return { projectData: nextProjectData, state: nextState };
}

function toProjectVariable(item) {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    valueType: item.type,
    address: item.address,
    expression: item.expression || normalizeName(item.name),
    comment: item.comment
  };
}

function toProjectActuator(item) {
  const klass = modelerState.actuatorClasses.find((candidate) => candidate.id === item.classId) || modelerState.actuatorClasses[0];
  const targets = splitTargets(item.targets);
  const executeTemplate = item.executeTemplate || klass.executeTemplate;
  const doneTemplate = item.doneTemplate || klass.doneTemplate;
  return {
    id: item.id,
    type: klass.id,
    name: item.name,
    targets,
    structTemplate: klass.structTemplate,
    executeTemplate,
    doneTemplate,
    actions: targets.map((target, index) => {
      const vars = { instanceName: item.name, targetName: target, targetIndex: index + 1 };
      return {
        id: makeActionId(target, index),
        label: target,
        command: cleanStStatement(renderActuatorTemplate(executeTemplate, vars)),
        done: cleanStExpression(renderActuatorTemplate(doneTemplate, vars))
      };
    })
  };
}

function renderActuatorTemplate(template, vars) {
  return String(template || "")
    .replaceAll("{实例名}", vars.instanceName)
    .replaceAll("{目标名}", vars.targetName)
    .replaceAll("{目标序号}", String(vars.targetIndex));
}

function cleanStStatement(value) {
  return String(value || "").trim().replace(/[;；]+$/, "");
}

function cleanStExpression(value) {
  return cleanStStatement(value).replace(/^IF\s+/i, "").replace(/\s+THEN$/i, "");
}

function exportModelerExcel() {
  const sheets = [
    ["项目", [["项目名称"], [modelerState.projectName]]],
    ["站", [["站ID", "站名称"], ...modelerState.stations.map((row) => [row.id, row.name])]],
    ["执行器类", [["类ID", "类名称", "结构体内容", "执行范例", "完成判断范例", "默认目标列表"], ...modelerState.actuatorClasses.map((row) => [row.id, row.name, row.structTemplate, row.executeTemplate, row.doneTemplate, row.defaultTargets])]],
    ["执行器实例", [["所属站", "执行器类", "实例ID", "实例名", "目标列表", "执行范例覆盖", "完成判断覆盖"], ...modelerState.actuatorInstances.map((row) => [row.stationId, row.classId, row.id, row.name, row.targets, row.executeTemplate, row.doneTemplate])]],
    ["传感器", variableSheetRows(modelerState.sensors, true)],
    ["定时器", [["所属站", "定时器ID", "名称", "默认时间ms"], ...modelerState.timers.map((row) => [row.stationId, row.id, row.name, row.defaultMs])]],
    ["系统变量", variableSheetRows(modelerState.systemVariables, false)],
    ["局部变量", variableSheetRows(modelerState.localVariables, true)],
    ["全局变量", variableSheetRows(modelerState.globalVariables, false)]
  ];
  const html = `<!doctype html><html><head><meta charset="UTF-8"><meta name="ProgId" content="Excel.Sheet"><style>
    table{border-collapse:collapse;margin:0 0 18px;} th,td{border:1px solid #8ea7bf;padding:4px 8px;mso-number-format:"\\@";vertical-align:top;} th{background:#eaf3ff;font-weight:700;} h2{font-family:Arial,"Microsoft YaHei";font-size:16px;}
  </style></head><body>${sheets.map(([name, rows]) => `<h2>${escapeHtml(name)}</h2><table>${rows.map((row, rowIndex) => `<tr>${row.map((cell) => rowIndex ? `<td>${escapeHtml(cell)}</td>` : `<th>${escapeHtml(cell)}</th>`).join("")}</tr>`).join("")}</table>`).join("")}</body></html>`;
  const date = new Date().toISOString().slice(0, 10);
  downloadTextFile(`PLCide-model-${date}.xls`, html, "application/vnd.ms-excel;charset=utf-8");
  showModelerValidation(validateModelerModel());
}

function variableSheetRows(rows, withStation) {
  const header = [...(withStation ? ["所属站"] : []), "变量ID", "名称", "类型", "地址", "表达式", "备注"];
  return [header, ...rows.map((row) => [...(withStation ? [row.stationId] : []), row.id, row.name, row.type, row.address, row.expression, row.comment])];
}
