import { tableSchemas } from "../model/schema.js";

export function renderModelerTable(state) {
  const schema = tableSchemas[state.activeSection];
  if (!schema.collection) return renderProjectTable(state.model.projectName);
  const rows = state.model[schema.collection] || [];
  return `
    <div class="panel-head">
      <div>
        <h2>${escapeHtml(schema.title)}</h2>
        <p>支持从 Excel 复制多行多列，直接粘贴到任意单元格。</p>
      </div>
      <button class="secondary" data-table-add="${schema.collection}">添加行</button>
    </div>
    <div class="grid-wrap">
      <table class="data-grid" style="min-width:${schema.columns.reduce((sum, column) => sum + column.width, 70)}px">
        <thead>
          <tr>${schema.columns.map((column) => `<th style="width:${column.width}px">${escapeHtml(column.label)}${column.required ? "<span>*</span>" : ""}</th>`).join("")}<th class="ops">操作</th></tr>
        </thead>
        <tbody>
          ${rows.map((row, rowIndex) => renderRow(schema, row, rowIndex)).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function bindModelerTable(root, store) {
  root.querySelectorAll("[data-cell]").forEach((cell) => {
    cell.addEventListener("input", () => {
      const { collection, row, key } = cell.dataset;
      store.setCell(collection, Number(row), key, cell.innerText, { emit: false });
    });
    cell.addEventListener("paste", (event) => {
      const text = event.clipboardData?.getData("text/plain") || "";
      if (!text) return;
      event.preventDefault();
      const { collection, row, col } = cell.dataset;
      const schema = Object.values(tableSchemas).find((item) => item.collection === collection);
      store.pasteMatrix(collection, Number(row), Number(col), schema.columns, parseClipboard(text));
    });
    cell.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        focusRelative(cell, 1, 0);
      }
      if (event.key === "Tab") {
        event.preventDefault();
        focusRelative(cell, 0, event.shiftKey ? -1 : 1);
      }
    });
  });
  root.querySelectorAll("[data-table-add]").forEach((button) => button.addEventListener("click", () => store.addRow(button.dataset.tableAdd)));
  root.querySelectorAll("[data-table-delete]").forEach((button) => button.addEventListener("click", () => store.deleteRow(button.dataset.tableDelete, Number(button.dataset.row))));
  root.querySelector("[data-project-name]")?.addEventListener("input", (event) => store.setProjectName(event.currentTarget.innerText, { emit: false }));
}

function renderProjectTable(projectName) {
  return `
    <div class="panel-head">
      <div>
        <h2>项目名称</h2>
        <p>一个项目填写一个名称。</p>
      </div>
    </div>
    <div class="grid-wrap compact">
      <table class="data-grid">
        <thead><tr><th style="width:320px">项目名称<span>*</span></th></tr></thead>
        <tbody>
          <tr><td><div class="edit-cell" contenteditable="true" spellcheck="false" data-project-name>${escapeHtml(projectName)}</div></td></tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderRow(schema, row, rowIndex) {
  return `
    <tr>
      ${schema.columns.map((column, colIndex) => `
        <td>
          <div
            class="edit-cell ${column.multiline ? "multiline" : ""}"
            contenteditable="true"
            spellcheck="false"
            data-cell
            data-collection="${schema.collection}"
            data-row="${rowIndex}"
            data-col="${colIndex}"
            data-key="${column.key}"
          >${escapeHtml(row[column.key] ?? "")}</div>
        </td>
      `).join("")}
      <td class="ops"><button class="delete" data-table-delete="${schema.collection}" data-row="${rowIndex}">删除</button></td>
    </tr>
  `;
}

function parseClipboard(text) {
  return String(text)
    .replace(/\r/g, "")
    .split("\n")
    .filter((line, index, lines) => line.length || index < lines.length - 1)
    .map((line) => line.split("\t"));
}

function focusRelative(cell, rowDelta, colDelta) {
  const row = Number(cell.dataset.row) + rowDelta;
  const col = Number(cell.dataset.col) + colDelta;
  document.querySelector(`[data-cell][data-collection="${cell.dataset.collection}"][data-row="${row}"][data-col="${col}"]`)?.focus();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
