import { generateStationCode } from "../services/codeGenerator.js";

export function renderMainFlow(state) {
  const station = currentStation(state);
  const steps = state.model.programs?.[station?.id] || [];
  return `
    <div class="panel-head">
      <div>
        <h2>主流程</h2>
        <p>按工站查看器件库、步骤流和代码预览。</p>
      </div>
      <div class="panel-actions">
        ${stationSelect(state)}
        <button class="secondary" data-program-add>添加步骤</button>
      </div>
    </div>
    <div class="main-flow-layout">
      <aside class="flow-library">
        ${libraryGroup("执行器", actuatorRows(state.model, station?.id))}
        ${libraryGroup("传感器", variableRows(state.model.sensors, station?.id))}
        ${libraryGroup("定时器", timerRows(state.model.timers, station?.id))}
        ${libraryGroup("系统变量", variableRows(state.model.systemVariables))}
        ${libraryGroup("局部变量", variableRows(state.model.localVariables, station?.id))}
        ${libraryGroup("全局变量", variableRows(state.model.globalVariables))}
      </aside>
      <section class="flow-board">
        ${steps.length ? steps.map((step, index) => flowStep(step, index)).join("") : `<div class="empty-flow">当前工站还没有程序步骤。点击“添加步骤”开始。</div>`}
      </section>
      <aside class="flow-code">
        <h3>代码预览</h3>
        <pre>${escapeHtml(generateStationCode(state.model, station?.id))}</pre>
      </aside>
    </div>
  `;
}

export function bindMainFlow(root, store) {
  root.querySelector("[data-main-station]")?.addEventListener("change", (event) => {
    store.setProgramStation(event.currentTarget.value);
  });
}

function flowStep(step, index) {
  return `
    <article class="flow-step-card">
      <div class="flow-step-no">S${escapeHtml(step.step || (index + 1) * 10)}</div>
      <div class="flow-step-body">
        <h3>${escapeHtml(step.note || "未命名步骤")}</h3>
        <div class="flow-step-meta">动作：${escapeHtml(step.actions || "无")}</div>
        <div class="flow-step-meta">条件：${escapeHtml(step.condition || "动作完成")}</div>
        <div class="flow-step-meta">超时：${escapeHtml(step.timeoutMs || 0)} ms · 下一步：${escapeHtml(step.nextStep ?? 0)}</div>
      </div>
      <button class="delete" data-program-delete data-row="${index}">删除</button>
    </article>
    ${index < 99 ? `<div class="flow-arrow">↓</div>` : ""}
  `;
}

function libraryGroup(title, rows) {
  return `
    <section class="library-group-v2">
      <header><span>${escapeHtml(title)}</span><strong>${rows.length}</strong></header>
      ${rows.length ? rows.map((row) => `
        <div class="library-row-v2">
          <div>${escapeHtml(row.title)}</div>
          <small>${escapeHtml(row.meta)}</small>
        </div>
      `).join("") : `<div class="library-empty">无</div>`}
    </section>
  `;
}

function actuatorRows(model, stationId) {
  return model.actuatorInstances.filter((item) => item.stationId === stationId).map((item) => ({
    title: item.name,
    meta: `${item.id} · ${String(item.targets || "").split(/[，,\n]/).filter(Boolean).length} 目标`
  }));
}

function variableRows(rows, stationId = null) {
  return rows.filter((item) => stationId == null || item.stationId === stationId).map((item) => ({
    title: item.name,
    meta: `${item.type || "BOOL"} · ${item.address || item.expression || item.id}`
  }));
}

function timerRows(rows, stationId) {
  return rows.filter((item) => item.stationId === stationId).map((item) => ({
    title: item.name,
    meta: `${item.id} · ${item.defaultMs || 0} ms`
  }));
}

function stationSelect(state) {
  const station = currentStation(state);
  return `<select class="preview-station-select" data-main-station data-program-station>${state.model.stations.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === station?.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select>`;
}

function currentStation(state) {
  return state.model.stations.find((item) => item.id === state.programStationId) || state.model.stations[0];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
