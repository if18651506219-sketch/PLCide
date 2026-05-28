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
        ${libraryGroup("执行器", actuatorRows(state.model, station?.id), true)}
        ${libraryGroup("传感器", variableRows(state.model.sensors, station?.id))}
        ${libraryGroup("定时器", timerRows(state.model.timers, station?.id))}
        ${libraryGroup("系统变量", variableRows(state.model.systemVariables))}
        ${libraryGroup("局部变量", variableRows(state.model.localVariables, station?.id))}
        ${libraryGroup("全局变量", variableRows(state.model.globalVariables))}
      </aside>
      <section class="flow-board">
        ${steps.length ? steps.map((step, index) => flowStep(step, index, index === (state.selectedProgramStepIndex || 0))).join("") : `<div class="empty-flow">当前工站还没有程序步骤。点击“添加步骤”开始。</div>`}
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
  root.querySelectorAll("[data-main-step]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      store.selectProgramStep(Number(card.dataset.mainStep));
    });
  });
  root.querySelectorAll("[data-main-cell]").forEach((cell) => {
    cell.addEventListener("input", () => {
      store.setProgramCell(Number(cell.dataset.row), cell.dataset.key, cell.innerText, { emit: false });
    });
    cell.addEventListener("blur", () => store.commitSilentChanges("主流程已更新"));
    cell.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && cell.dataset.key !== "actions" && cell.dataset.key !== "condition") {
        event.preventDefault();
        cell.blur();
      }
    });
  });
  root.querySelectorAll("[data-insert-action]").forEach((button) => {
    button.addEventListener("click", () => store.appendActionToSelectedStep(button.dataset.insertAction));
  });
}

function flowStep(step, index, selected) {
  return `
    <article class="flow-step-card ${selected ? "is-selected" : ""}" data-main-step="${index}">
      <div class="flow-step-no">S<span class="flow-inline-edit" contenteditable="true" spellcheck="false" data-main-cell data-row="${index}" data-key="step">${escapeHtml(step.step || (index + 1) * 10)}</span></div>
      <div class="flow-step-body">
        <h3 class="flow-card-edit" contenteditable="true" spellcheck="false" data-main-cell data-row="${index}" data-key="note">${escapeHtml(step.note || "未命名步骤")}</h3>
        <label class="flow-step-field"><span>动作</span><div class="flow-card-edit multiline" contenteditable="true" spellcheck="false" data-main-cell data-row="${index}" data-key="actions">${escapeHtml(step.actions || "")}</div></label>
        <label class="flow-step-field"><span>条件</span><div class="flow-card-edit" contenteditable="true" spellcheck="false" data-main-cell data-row="${index}" data-key="condition">${escapeHtml(step.condition || "")}</div></label>
        <div class="flow-step-field-row">
          <label class="flow-step-field small"><span>超时ms</span><div class="flow-card-edit" contenteditable="true" spellcheck="false" data-main-cell data-row="${index}" data-key="timeoutMs">${escapeHtml(step.timeoutMs || 0)}</div></label>
          <label class="flow-step-field small"><span>下一步</span><div class="flow-card-edit" contenteditable="true" spellcheck="false" data-main-cell data-row="${index}" data-key="nextStep">${escapeHtml(step.nextStep ?? 0)}</div></label>
        </div>
      </div>
      <button class="delete" data-program-delete data-row="${index}">删除</button>
    </article>
    ${index < 99 ? `<div class="flow-arrow">↓</div>` : ""}
  `;
}

function libraryGroup(title, rows, insertable = false) {
  return `
    <section class="library-group-v2">
      <header><span>${escapeHtml(title)}</span><strong>${rows.length}</strong></header>
      ${rows.length ? rows.map((row) => `
        <div class="library-row-v2">
          <div>${escapeHtml(row.title)}</div>
          <small>${escapeHtml(row.meta)}</small>
          ${insertable && row.actions?.length ? `<div class="library-action-buttons">${row.actions.map((action) => `<button type="button" data-insert-action="${escapeHtml(action)}">${escapeHtml(action.split(":").slice(1).join(":") || action)}</button>`).join("")}</div>` : ""}
        </div>
      `).join("") : `<div class="library-empty">无</div>`}
    </section>
  `;
}

function actuatorRows(model, stationId) {
  return model.actuatorInstances.filter((item) => item.stationId === stationId).map((item) => ({
    title: item.name,
    meta: `${item.id} · ${String(item.targets || "").split(/[，,\n]/).filter(Boolean).length} 目标`,
    actions: String(item.targets || "").split(/[，,\n]/).map((target) => target.trim()).filter(Boolean).map((target) => `${item.id}:${target}`)
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
