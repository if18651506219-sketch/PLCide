import { stationTimers } from "./defaultProjectModel.js";

export function cloneModel(model) {
  return JSON.parse(JSON.stringify(model));
}

export function createEmptyRow(collection, model) {
  const stationId = model.stations[0]?.id || "station1";
  const firstClass = model.actuatorClasses[0] || { id: "cylinder", defaultTargets: "初始位，工作位" };
  const next = (model[collection]?.length || 0) + 1;

  if (collection === "stations") return { id: `station${next}`, name: `站${next}` };
  if (collection === "actuatorClasses") {
    return {
      id: `custom${next}`,
      name: "自定义执行器",
      defaultTargets: "动作1，动作2",
      structTemplate: "REQ : BOOL\nDONE : BOOL",
      executeTemplate: "{实例名}.{目标名} := TRUE",
      doneTemplate: "{实例名}.{目标名}DONE"
    };
  }
  if (collection === "actuatorInstances") {
    return { stationId, classId: firstClass.id, id: `actuator${next}`, name: "新执行器", targets: firstClass.defaultTargets, executeTemplate: "", doneTemplate: "" };
  }
  if (collection === "timers") return { stationId, id: `timer${next}`, name: "新定时器", defaultMs: 1000 };
  return {
    stationId: collection === "systemVariables" || collection === "globalVariables" ? "" : stationId,
    id: `var${next}`,
    name: "新变量",
    type: "BOOL",
    address: "",
    expression: "NewVar",
    comment: ""
  };
}

export function syncStationSideEffects(model, previousStations) {
  const previousIds = new Set(previousStations.map((station) => station.id));
  model.stations.forEach((station) => {
    if (station.id && !previousIds.has(station.id)) model.timers.push(...stationTimers(station.id));
  });
}

export function splitTargets(value) {
  return String(value || "")
    .split(/[，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\u4e00-\u9fa5]/g, "_");
}
