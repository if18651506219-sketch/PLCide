import { generateStationCode } from "../services/codeGenerator.js";

const PROGRAM_COLUMNS = [
  { key: "step", label: "S", width: 80, numeric: true },
  { key: "note", label: "节点注释", width: 220 },
  { key: "actions", label: "动作", width: 360 },
  { key: "condition", label: "附加条件", width: 260 },
  { key: "timeoutMs", label: "超时ms", width: 130, numeric: true },
  { key: "nextStep", label: "下一步", width: 120, numeric: true }
];

export function renderProgramFlow(state) {
  const station = currentStation(state);
  const rows = state.model.programs?.[station?.id] || [];
  return `
    <div class="panel-head">
      <div>
        <h2>程序流</h2>
        <p>动作格式：执行器实例ID:目标名；多动作可换行或用逗号分隔。</p>
      </div>
      <div class="panel-actions">
        ${stationSelect(state, "data-program-station")}
        <button class="secondary" data-program-add>添加步骤</button>
      </div>
    </div>
    <div class="program-layout">
      <div class="grid-wrap">
        <table class="data-grid program-grid" style="min-width:${PROGRAM_COLUMNS.reduce((sum, column) => sum + column.width, 70)}px">
          <thead><tr>${PROGRAM_COLUMNS.map((column) => `<th style="width:${column.width}px">${column.label}</th>`).join("")}<th class="ops">操作</th></tr></thead>
          <tbody>${rows.map((row, rowIndex) => renderProgramRow(row, rowIndex)).join("")}</tbody>
        </table>
      </div>
      <aside class="action-help">
        <h3>动作参考</h3>
        ${renderActionReference(state.model, station?.id)}
      </aside>
    </div>
  `;
}

export function renderCodePreview(state) {
  const station = currentStation(state);
  const code = generateStationCode(state.model, station?.id);
  return `
    <div class="panel-head">
      <div>
        <h2>代码预览</h2>
        <p>由当前工站程序流生成，保存项目时不丢失程序流。</p>
      </div>
      <div class="panel-actions">
        ${stationSelect(state, "data-program-station")}
        <button class="secondary" data-copy-code>复制代码</button>
      </div>
    </div>
    <div class="code-v2-wrap">
      <pre class="code-v2">${escapeHtml(code)}</pre>
    </div>
  `;
}

export function bindProgramFlow(root, store) {
  root.querySelectorAll("[data-program-station]").forEach((select) => {
    select.addEventListener("change", (event) => store.setProgramStation(event.currentTarget.value));
  });
  root.querySelector("[data-program-add]")?.addEventListener("click", () => store.addProgramStep());
  root.querySelectorAll("[data-program-cell]").forEach((cell) => {
    cell.addEventListener("input", () => {
      store.setProgramCell(Number(cell.dataset.row), cell.dataset.key, cell.innerText, { emit: false });
    });
    cell.addEventListener("blur", () => store.commitSilentChanges("程序流已更新"));
    cell.addEventListener("paste", (event) => {
      const text = event.clipboardData?.getData("text/plain") || "";
      if (!text) return;
      event.preventDefault();
      store.pasteProgramMatrix(Number(cell.dataset.row), Number(cell.dataset.col), PROGRAM_COLUMNS, parseClipboard(text));
    });
    cell.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        focusProgramCell(cell, 1, 0);
      }
      if (event.key === "Tab") {
        event.preventDefault();
        focusProgramCell(cell, 0, event.shiftKey ? -1 : 1);
      }
    });
  });
  root.querySelectorAll("[data-program-delete]").forEach((button) => {
    button.addEventListener("click", () => store.deleteProgramStep(Number(button.dataset.row)));
  });
  root.querySelector("[data-copy-code]")?.addEventListener("click", () => {
    const code = root.querySelector(".code-v2")?.innerText || "";
    navigator.clipboard?.writeText(code)
      .then(() => store.setToast("代码已复制"))
      .catch(() => store.setToast("复制失败，可手动选择代码"));
  });
}

export function programColumns() {
  return PROGRAM_COLUMNS;
}

function renderProgramRow(row, rowIndex) {
  return `
    <tr>
      ${PROGRAM_COLUMNS.map((column, colIndex) => `
        <td>
          <div class="edit-cell ${column.key === "actions" || column.key === "condition" ? "multiline" : ""}" contenteditable="true" spellcheck="false" data-program-cell data-row="${rowIndex}" data-col="${colIndex}" data-key="${column.key}">${escapeHtml(row[column.key] ?? "")}</div>
        </td>
      `).join("")}
      <td class="ops"><button class="delete" data-program-delete data-row="${rowIndex}">删除</button></td>
    </tr>
  `;
}

function renderActionReference(model, stationId) {
  const rows = model.actuatorInstances
    .filter((item) => item.stationId === stationId)
    .flatMap((item) => String(item.targets || "").split(/[，,\n]/).map((target) => target.trim()).filter(Boolean).map((target) => `${item.id}:${target}`));
  return rows.length
    ? `<div class="reference-list">${rows.map((item) => `<code>${escapeHtml(item)}</code>`).join("")}</div>`
    : `<p class="muted">当前工站暂无执行器实例。</p>`;
}

function stationSelect(state, attr) {
  const station = currentStation(state);
  return `<select class="preview-station-select" ${attr}>${state.model.stations.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === station?.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select>`;
}

function currentStation(state) {
  return state.model.stations.find((item) => item.id === state.programStationId) || state.model.stations[0];
}

function parseClipboard(text) {
  return String(text).replace(/\r/g, "").split("\n").filter((line, index, lines) => line.length || index < lines.length - 1).map((line) => line.split("\t"));
}

function focusProgramCell(cell, rowDelta, colDelta) {
  const row = Number(cell.dataset.row) + rowDelta;
  const col = Number(cell.dataset.col) + colDelta;
  document.querySelector(`[data-program-cell][data-row="${row}"][data-col="${col}"]`)?.focus();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
