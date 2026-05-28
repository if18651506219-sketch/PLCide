import { normalizeName, splitTargets } from "../model/modelOps.js";

export function buildLegacyProjectPayload(model) {
  const projectData = {
    name: model.projectName,
    system: {
      id: "system",
      name: "系统站",
      systemConditions: model.systemVariables.map(toVariable),
      timers: []
    },
    stations: model.stations.map((station) => ({
      id: station.id,
      name: station.name,
      actuators: model.actuatorInstances
        .filter((item) => item.stationId === station.id)
        .map((item) => toActuator(item, model)),
      sensors: model.sensors
        .filter((item) => item.stationId === station.id)
        .map(toVariable)
    }))
  };

  const state = {
    activeStationId: model.stations[0]?.id || "",
    stations: Object.fromEntries(model.stations.map((station) => [station.id, {
      steps: [],
      customItems: {
        actuator: [],
        sensor: [],
        system: [],
        delay: model.timers.filter((timer) => timer.stationId === station.id).map((timer) => ({
          id: timer.id,
          name: timer.name,
          type: "delay",
          defaultMs: Number(timer.defaultMs) || 1000
        })),
        local: []
      },
      localVariables: model.localVariables.filter((item) => item.stationId === station.id).map(toVariable),
      codeDraft: "",
      codeEdited: false
    }])),
    globalVariables: model.globalVariables.map(toVariable),
    paneSizes: { variable: 280, code: 520 }
  };

  return {
    fileType: "plc-ai-ide-project-v1",
    exportedAt: new Date().toISOString(),
    projectData,
    state
  };
}

function toVariable(item) {
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

function toActuator(item, model) {
  const klass = model.actuatorClasses.find((candidate) => candidate.id === item.classId) || model.actuatorClasses[0];
  const executeTemplate = item.executeTemplate || klass.executeTemplate;
  const doneTemplate = item.doneTemplate || klass.doneTemplate;
  return {
    id: item.id,
    type: klass.id,
    name: item.name,
    structTemplate: klass.structTemplate,
    executeTemplate,
    doneTemplate,
    actions: splitTargets(item.targets).map((target, index) => ({
      id: actionId(target, index),
      label: target,
      command: renderTemplate(executeTemplate, item.name, target, index + 1).replace(/[;；]+$/, ""),
      done: renderTemplate(doneTemplate, item.name, target, index + 1).replace(/[;；]+$/, "")
    }))
  };
}

function renderTemplate(template, instanceName, targetName, targetIndex) {
  return String(template || "")
    .replaceAll("{实例名}", instanceName)
    .replaceAll("{目标名}", targetName)
    .replaceAll("{目标序号}", String(targetIndex))
    .trim();
}

function actionId(target, index) {
  const ascii = normalizeName(target).replace(/[^A-Za-z0-9_]/g, "_").toLowerCase();
  return ascii || `target${index + 1}`;
}
