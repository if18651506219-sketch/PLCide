import { createStore } from "./store/store.js";
import { defaultProjectModel } from "./model/defaultProjectModel.js";
import { renderApp } from "./ui/appShell.js";

const store = createStore(defaultProjectModel());

renderApp(document.getElementById("app"), store);
