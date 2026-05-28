import { modelSections } from "../model/schema.js";
import { exportStandardExcel } from "../services/excelExport.js";
import { buildLegacyProjectPayload } from "../services/legacyAdapter.js";
import { bindModelerTable, renderModelerTable } from "./modelerTable.js";

export function renderApp(root, store) {
  const redraw = () => {
    const state = store.getState();
    root.innerHTML = `
      <div class="v2-shell">
        <header class="v2-topbar">
          <div class="brand">
            <div class="mark">PLC</div>
            <div>
              <h1>PLC-AI IDE V2</h1>
              <p>参数模型驱动的工程配置</p>
            </div>
          </div>
          <div class="toolbar">
            <a class="secondary" href="index.html">旧版Demo</a>
            <button class="secondary" data-action="validate">校验</button>
            <button class="secondary" data-action="exportExcel">生成标准Excel</button>
            <button class="secondary primary" data-action="exportProject">导出IDE项目</button>
          </div>
        </header>
        <main class="v2-workspace">
          <aside class="section-nav">
            ${modelSections.map((section) => `<button class="${section.id === state.activeSection ? "active" : ""}" data-section="${section.id}">${section.label}</button>`).join("")}
          </aside>
          <section class="modeler-panel">
            ${renderModelerTable(state)}
          </section>
          <aside class="inspector">
            ${renderInspector(state)}
          </aside>
        </main>
      </div>
    `;
    bindShell(root, store);
  };

  store.subscribe(redraw);
  redraw();
}

function bindShell(root, store) {
  root.querySelectorAll("[data-section]").forEach((button) => {
    button.addEventListener("click", () => store.setActiveSection(button.dataset.section));
  });
  root.querySelector('[data-action="validate"]')?.addEventListener("click", () => store.validate());
  root.querySelector('[data-action="exportExcel"]')?.addEventListener("click", () => exportStandardExcel(store.getState().model));
  root.querySelector('[data-action="exportProject"]')?.addEventListener("click", () => {
    const errors = store.validate();
    if (errors.length) return;
    downloadJson(`PLCide-v2-project-${new Date().toISOString().slice(0, 10)}.plcide.json`, buildLegacyProjectPayload(store.getState().model));
    store.setToast("已导出旧版 IDE 可打开的项目文件");
  });
  bindModelerTable(root, store);
}

function renderInspector(state) {
  const errors = state.validation;
  return `
    <div class="inspector-card">
      <h2>状态</h2>
      <p>${escapeHtml(state.toast || "未操作")}</p>
    </div>
    <div class="inspector-card">
      <h2>项目摘要</h2>
      <dl>
        <dt>站</dt><dd>${state.model.stations.length}</dd>
        <dt>执行器类</dt><dd>${state.model.actuatorClasses.length}</dd>
        <dt>执行器实例</dt><dd>${state.model.actuatorInstances.length}</dd>
        <dt>变量</dt><dd>${state.model.sensors.length + state.model.systemVariables.length + state.model.localVariables.length + state.model.globalVariables.length}</dd>
      </dl>
    </div>
    <div class="inspector-card grow">
      <h2>校验</h2>
      ${errors.length ? `<div class="error-list">${errors.slice(0, 30).map((item) => `<div class="error-item"><strong>${escapeHtml(item.section)} 第${item.row}行</strong><span>${escapeHtml(item.message)}</span></div>`).join("")}</div>` : `<p class="muted">点击校验查看问题。</p>`}
    </div>
  `;
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
