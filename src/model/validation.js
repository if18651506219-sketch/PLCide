import { splitTargets } from "./modelOps.js";

export function validateProjectModel(model) {
  const errors = [];
  if (!model.projectName.trim()) errors.push(error("项目名称", 1, "项目名称不能为空"));
  unique(errors, model.stations, "站名称", "id", "站ID");
  unique(errors, model.stations, "站名称", "name", "站名称");
  unique(errors, model.actuatorClasses, "执行器类", "id", "类ID");

  model.actuatorClasses.forEach((row, index) => {
    requireFields(errors, "执行器类", index, row, [["id", "类ID"], ["name", "类名称"], ["defaultTargets", "默认目标列表"], ["executeTemplate", "执行范例"], ["doneTemplate", "完成判断范例"]]);
    if (!splitTargets(row.defaultTargets).length) errors.push(error("执行器类", index + 1, "默认目标列表不能为空"));
    if (!String(row.executeTemplate || "").includes("{实例名}")) errors.push(error("执行器类", index + 1, "执行范例必须包含 {实例名}"));
    if (!String(row.doneTemplate || "").includes("{实例名}")) errors.push(error("执行器类", index + 1, "完成判断范例必须包含 {实例名}"));
  });

  entityRows(errors, model, model.actuatorInstances, "执行器实例", true, true);
  model.actuatorInstances.forEach((row, index) => {
    if (!splitTargets(row.targets).length) errors.push(error("执行器实例", index + 1, "目标列表不能为空"));
  });
  entityRows(errors, model, model.sensors, "传感器", true, false);
  entityRows(errors, model, model.timers, "定时器", true, false);
  entityRows(errors, model, model.systemVariables, "系统变量", false, false);
  entityRows(errors, model, model.localVariables, "局部变量", true, false);
  entityRows(errors, model, model.globalVariables, "全局变量", false, false);
  return errors;
}

function entityRows(errors, model, rows, label, needsStation, needsClass) {
  const stations = new Set(model.stations.map((station) => station.id));
  const classes = new Set(model.actuatorClasses.map((item) => item.id));
  const seen = new Set();
  rows.forEach((row, index) => {
    requireFields(errors, label, index, row, [["id", "ID"], ["name", "名称"]]);
    if (needsStation && !stations.has(row.stationId)) errors.push(error(label, index + 1, `所属站不存在：${row.stationId || "(空)"}`));
    if (needsClass && !classes.has(row.classId)) errors.push(error(label, index + 1, `执行器类不存在：${row.classId || "(空)"}`));
    const scopedId = `${row.stationId || "GLOBAL"}:${row.id}`;
    if (seen.has(scopedId)) errors.push(error(label, index + 1, `ID重复：${row.id}`));
    seen.add(scopedId);
  });
}

function unique(errors, rows, section, field, label) {
  const seen = new Set();
  rows.forEach((row, index) => {
    const value = String(row[field] || "").trim();
    if (!value) errors.push(error(section, index + 1, `${label}不能为空`));
    if (value && seen.has(value)) errors.push(error(section, index + 1, `${label}重复：${value}`));
    seen.add(value);
  });
}

function requireFields(errors, section, index, row, fields) {
  fields.forEach(([key, label]) => {
    if (!String(row[key] ?? "").trim()) errors.push(error(section, index + 1, `${label}不能为空`));
  });
}

function error(section, row, message) {
  return { section, row, message };
}
