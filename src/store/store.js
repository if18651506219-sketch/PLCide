import { cloneModel, createEmptyRow, syncStationSideEffects } from "../model/modelOps.js";
import { validateProjectModel } from "../model/validation.js";

export function createStore(initialModel) {
  let state = {
    model: cloneModel(initialModel),
    activeSection: "mainFlow",
    previewStationId: initialModel.stations[0]?.id || "",
    programStationId: initialModel.stations[0]?.id || "",
    selectedProgramStepIndex: 0,
    validation: [],
    selectedCell: null,
    toast: "V2 参数建模已就绪"
  };
  const listeners = new Set();

  const api = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setActiveSection(section) {
      state = { ...state, activeSection: section, selectedCell: null };
      emit();
    },
    replaceModel(model, toast = "项目已打开") {
      state = {
        ...state,
        model: cloneModel(model),
        activeSection: "mainFlow",
        previewStationId: model.stations[0]?.id || "",
        programStationId: model.stations[0]?.id || "",
        selectedProgramStepIndex: 0,
        validation: [],
        selectedCell: null,
        toast
      };
      emit();
    },
    setProjectName(value, options = {}) {
      state = { ...state, model: { ...state.model, projectName: value } };
      if (options.emit !== false) emit();
    },
    setCell(collection, rowIndex, key, value, options = {}) {
      const model = cloneModel(state.model);
      const beforeStations = model.stations.map((row) => ({ ...row }));
      const row = model[collection]?.[rowIndex];
      if (!row) return;
      row[key] = key === "defaultMs" ? Number(value) || 0 : value;
      if (collection === "stations") syncStationSideEffects(model, beforeStations);
      state = { ...state, model };
      if (options.emit !== false) emit();
    },
    pasteMatrix(collection, rowIndex, colIndex, columns, matrix) {
      const model = cloneModel(state.model);
      const beforeStations = model.stations.map((row) => ({ ...row }));
      while (model[collection].length < rowIndex + matrix.length) {
        model[collection].push(createEmptyRow(collection, model));
      }
      matrix.forEach((rowValues, rOffset) => {
        rowValues.forEach((value, cOffset) => {
          const column = columns[colIndex + cOffset];
          if (!column) return;
          model[collection][rowIndex + rOffset][column.key] = column.numeric ? Number(value) || 0 : String(value ?? "").trim();
        });
      });
      if (collection === "stations") syncStationSideEffects(model, beforeStations);
      state = { ...state, model, toast: `已粘贴 ${matrix.length} 行` };
      emit();
    },
    addRow(collection) {
      const model = cloneModel(state.model);
      const row = createEmptyRow(collection, model);
      model[collection].push(row);
      if (collection === "stations") syncStationSideEffects(model, []);
      state = { ...state, model };
      emit();
    },
    deleteRow(collection, index) {
      const model = cloneModel(state.model);
      model[collection].splice(index, 1);
      state = { ...state, model };
      emit();
    },
    validate() {
      const validation = validateProjectModel(state.model);
      state = { ...state, validation, toast: validation.length ? `发现 ${validation.length} 个问题` : "校验通过" };
      emit();
      return validation;
    },
    setToast(toast) {
      state = { ...state, toast };
      emit();
    },
    setPreviewStation(previewStationId) {
      state = { ...state, previewStationId };
      emit();
    },
    setProgramStation(programStationId) {
      state = { ...state, programStationId, selectedProgramStepIndex: 0 };
      emit();
    },
    selectProgramStep(index) {
      state = { ...state, selectedProgramStepIndex: index };
      emit();
    },
    addProgramStep() {
      const model = cloneModel(state.model);
      ensurePrograms(model);
      const stationId = state.programStationId || model.stations[0]?.id;
      const rows = model.programs[stationId] || [];
      const maxStep = rows.reduce((max, row) => Math.max(max, Number(row.step) || 0), 0);
      rows.push({ step: maxStep + 10 || 10, note: "新步骤", actions: "", condition: "", timeoutMs: 8000, nextStep: 0 });
      model.programs[stationId] = rows;
      state = { ...state, model, selectedProgramStepIndex: rows.length - 1, toast: "已添加程序步骤" };
      emit();
    },
    deleteProgramStep(index) {
      const model = cloneModel(state.model);
      ensurePrograms(model);
      const stationId = state.programStationId || model.stations[0]?.id;
      model.programs[stationId]?.splice(index, 1);
      const nextIndex = Math.max(0, Math.min(state.selectedProgramStepIndex, (model.programs[stationId]?.length || 1) - 1));
      state = { ...state, model, selectedProgramStepIndex: nextIndex, toast: "已删除程序步骤" };
      emit();
    },
    setProgramCell(rowIndex, key, value, options = {}) {
      const model = cloneModel(state.model);
      ensurePrograms(model);
      const stationId = state.programStationId || model.stations[0]?.id;
      const row = model.programs[stationId]?.[rowIndex];
      if (!row) return;
      row[key] = key === "step" || key === "timeoutMs" || key === "nextStep" ? Number(value) || 0 : value;
      state = { ...state, model };
      if (options.emit !== false) emit();
    },
    pasteProgramMatrix(rowIndex, colIndex, columns, matrix) {
      const model = cloneModel(state.model);
      ensurePrograms(model);
      const stationId = state.programStationId || model.stations[0]?.id;
      const rows = model.programs[stationId] || [];
      while (rows.length < rowIndex + matrix.length) rows.push({ step: (rows.length + 1) * 10, note: "", actions: "", condition: "", timeoutMs: 8000, nextStep: 0 });
      matrix.forEach((rowValues, rOffset) => {
        rowValues.forEach((value, cOffset) => {
          const column = columns[colIndex + cOffset];
          if (!column) return;
          rows[rowIndex + rOffset][column.key] = column.numeric ? Number(value) || 0 : String(value ?? "").trim();
        });
      });
      model.programs[stationId] = rows;
      state = { ...state, model, toast: `已粘贴 ${matrix.length} 行程序流` };
      emit();
    },
    appendActionToSelectedStep(actionText) {
      const model = cloneModel(state.model);
      ensurePrograms(model);
      const stationId = state.programStationId || model.stations[0]?.id;
      const rows = model.programs[stationId] || [];
      if (!rows.length) rows.push({ step: 10, note: "新步骤", actions: "", condition: "", timeoutMs: 8000, nextStep: 0 });
      const index = Math.max(0, Math.min(state.selectedProgramStepIndex || 0, rows.length - 1));
      const row = rows[index];
      const existing = String(row.actions || "").split(/[，,\n]/).map((item) => item.trim()).filter(Boolean);
      if (!existing.includes(actionText)) existing.push(actionText);
      row.actions = existing.join("\n");
      model.programs[stationId] = rows;
      state = { ...state, model, selectedProgramStepIndex: index, toast: `已插入动作：${actionText}` };
      emit();
    },
    appendConditionToSelectedStep(expressionText) {
      const model = cloneModel(state.model);
      ensurePrograms(model);
      const stationId = state.programStationId || model.stations[0]?.id;
      const rows = model.programs[stationId] || [];
      if (!rows.length) rows.push({ step: 10, note: "新步骤", actions: "", condition: "", timeoutMs: 8000, nextStep: 0 });
      const index = Math.max(0, Math.min(state.selectedProgramStepIndex || 0, rows.length - 1));
      const row = rows[index];
      const existing = String(row.condition || "").trim();
      row.condition = existing ? `${existing} AND ${expressionText}` : expressionText;
      model.programs[stationId] = rows;
      state = { ...state, model, selectedProgramStepIndex: index, toast: `已插入条件：${expressionText}` };
      emit();
    },
    commitSilentChanges(toast) {
      state = { ...state, toast: toast || state.toast };
      emit();
    }
  };

  function emit() {
    listeners.forEach((listener) => listener(state));
  }

  return api;
}

function ensurePrograms(model) {
  if (!model.programs) model.programs = {};
  model.stations.forEach((station) => {
    if (!Array.isArray(model.programs[station.id])) model.programs[station.id] = [];
  });
}
