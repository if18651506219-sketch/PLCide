import { defaultProjectModel } from "../model/defaultProjectModel.js";
import { tableSchemas } from "../model/schema.js";

const SHEET_TO_SECTION = {
  "站": "stations",
  "执行器类": "actuatorClasses",
  "执行器实例": "actuatorInstances",
  "传感器": "sensors",
  "定时器": "timers",
  "系统变量": "systemVariables",
  "局部变量": "localVariables",
  "全局变量": "globalVariables"
};

export function readStandardExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(parseStandardExcelText(String(reader.result || "")));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsText(file, "utf-8");
  });
}

export function parseStandardExcelText(text) {
  if (!/<table[\s>]/i.test(text)) throw new Error("Only standard HTML .xls is supported");
  const doc = new DOMParser().parseFromString(text, "text/html");
  const model = defaultProjectModel();

  [...doc.querySelectorAll("h2")].forEach((heading) => {
    const sheetName = heading.textContent.trim();
    const table = nextTable(heading);
    if (!table) return;
    const matrix = readTable(table);
    if (!matrix.length) return;
    if (sheetName === "项目") {
      model.projectName = matrix[1]?.[0] || model.projectName;
      return;
    }
    const section = SHEET_TO_SECTION[sheetName];
    if (!section) return;
    model[section] = rowsFromMatrix(section, matrix);
  });

  return model;
}

function rowsFromMatrix(section, matrix) {
  const schema = tableSchemas[section];
  const headers = matrix[0] || [];
  return matrix.slice(1)
    .filter((row) => row.some((cell) => String(cell).trim()))
    .map((row) => {
      const item = {};
      schema.columns.forEach((column) => {
        const index = headers.indexOf(column.label);
        item[column.key] = index >= 0 ? row[index] || "" : "";
        if (column.numeric) item[column.key] = Number(item[column.key]) || 0;
      });
      return item;
    });
}

function nextTable(node) {
  let cursor = node.nextElementSibling;
  while (cursor && cursor.tagName !== "TABLE") cursor = cursor.nextElementSibling;
  return cursor;
}

function readTable(table) {
  return [...table.querySelectorAll("tr")].map((row) =>
    [...row.children].map((cell) => cell.textContent.trim())
  );
}
