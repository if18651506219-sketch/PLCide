import { cloneModel, createEmptyRow, syncStationSideEffects } from "../model/modelOps.js";
import { validateProjectModel } from "../model/validation.js";

export function createStore(initialModel) {
  let state = {
    model: cloneModel(initialModel),
    activeSection: "project",
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
    }
  };

  function emit() {
    listeners.forEach((listener) => listener(state));
  }

  return api;
}
