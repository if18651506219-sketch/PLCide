import { createStore } from "./store/store.js";
import { defaultProjectModel } from "./model/defaultProjectModel.js";
import { loadDraftModel, saveDraftModel } from "./services/projectFiles.js";
import { renderApp } from "./ui/appShell.js";

const store = createStore(loadDraftModel() || defaultProjectModel());

renderApp(document.getElementById("app"), store);

store.subscribe((state) => {
  saveDraftModel(state.model);
});
