import { tableSchemas } from "../model/schema.js";

export function exportStandardExcel(model) {
  const sheets = [
    ["项目", [["项目名称"], [model.projectName]]],
    ["站", rowsFor("stations", model)],
    ["执行器类", rowsFor("actuatorClasses", model)],
    ["执行器实例", rowsFor("actuatorInstances", model)],
    ["传感器", rowsFor("sensors", model)],
    ["定时器", rowsFor("timers", model)],
    ["系统变量", rowsFor("systemVariables", model)],
    ["局部变量", rowsFor("localVariables", model)],
    ["全局变量", rowsFor("globalVariables", model)],
    ["程序流", programRows(model)]
  ];
  const html = `<!doctype html><html><head><meta charset="UTF-8"><meta name="ProgId" content="Excel.Sheet"><style>
    body{font-family:Arial,"Microsoft YaHei",sans-serif;} table{border-collapse:collapse;margin:0 0 20px;} th,td{border:1px solid #8ea7bf;padding:5px 9px;mso-number-format:"\\@";vertical-align:top;white-space:pre-wrap;} th{background:#eaf3ff;font-weight:700;} h2{font-size:16px;margin:18px 0 8px;}
  </style></head><body>${sheets.map(([name, rows]) => `<h2>${escapeHtml(name)}</h2><table>${rows.map((row, index) => `<tr>${row.map((cell) => index ? `<td>${escapeHtml(cell)}</td>` : `<th>${escapeHtml(cell)}</th>`).join("")}</tr>`).join("")}</table>`).join("")}</body></html>`;
  downloadText(`PLCide-model-v2-${new Date().toISOString().slice(0, 10)}.xls`, html, "application/vnd.ms-excel;charset=utf-8");
}

function programRows(model) {
  const header = ["所属站", "步骤号", "节点注释", "动作", "附加条件", "超时ms", "下一步"];
  const rows = Object.entries(model.programs || {}).flatMap(([stationId, steps]) =>
    steps.map((step) => [stationId, step.step, step.note, step.actions, step.condition, step.timeoutMs, step.nextStep])
  );
  return [header, ...rows];
}

function rowsFor(section, model) {
  const schema = tableSchemas[section];
  const columns = schema.columns;
  return [
    columns.map((column) => column.label),
    ...model[schema.collection].map((row) => columns.map((column) => row[column.key] ?? ""))
  ];
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
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
