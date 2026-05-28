import { buildLegacyProjectPayload } from "../services/legacyAdapter.js";

export function renderProjectPreview(state) {
  const payload = buildLegacyProjectPayload(state.model);
  const stations = payload.projectData.stations;
  const selectedId = state.previewStationId && stations.some((station) => station.id === state.previewStationId)
    ? state.previewStationId
    : stations[0]?.id;
  const station = stations.find((item) => item.id === selectedId) || stations[0];
  if (!station) return `<div class="preview-empty">暂无工站。</div>`;
  const work = payload.state.stations[station.id] || { customItems: { delay: [] }, localVariables: [] };
  return `
    <div class="preview-head">
      <h2>工站预览</h2>
      <select class="preview-station-select" data-preview-station>
        ${stations.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === station.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
      </select>
    </div>
    <div class="preview-scroll">
      ${previewGroup("执行器", station.actuators.map((item) => ({
        title: item.name,
        meta: `${typeLabel(item.type)} · ${item.actions.length} 目标`,
        detail: item.actions.map((action) => action.label).join("，")
      })))}
      ${previewGroup("传感器", station.sensors.map((item) => ({
        title: item.name,
        meta: `${item.valueType || item.type || "BOOL"} · ${item.address || "-"}`,
        detail: item.expression || ""
      })))}
      ${previewGroup("定时器", work.customItems.delay.map((item) => ({
        title: item.name,
        meta: `${item.defaultMs || 0} ms`,
        detail: item.id
      })))}
      ${previewGroup("局部变量", work.localVariables.map((item) => ({
        title: item.name,
        meta: `${item.valueType || item.type || "BOOL"} · ${item.address || "-"}`,
        detail: item.expression || ""
      })))}
      ${previewGroup("系统变量", payload.projectData.system.systemConditions.map((item) => ({
        title: item.name,
        meta: `${item.valueType || item.type || "BOOL"} · ${item.address || "-"}`,
        detail: item.expression || ""
      })))}
      ${previewGroup("全局变量", payload.state.globalVariables.map((item) => ({
        title: item.name,
        meta: `${item.valueType || item.type || "BOOL"} · ${item.address || "-"}`,
        detail: item.expression || ""
      })))}
    </div>
  `;
}

export function bindProjectPreview(root, store) {
  root.querySelector("[data-preview-station]")?.addEventListener("change", (event) => {
    store.setPreviewStation(event.currentTarget.value);
  });
}

function previewGroup(title, rows) {
  return `
    <section class="preview-group">
      <header><span>${escapeHtml(title)}</span><strong>${rows.length}</strong></header>
      ${rows.length ? rows.map(previewItem).join("") : `<div class="preview-empty">无</div>`}
    </section>
  `;
}

function previewItem(item) {
  return `
    <article class="preview-item">
      <div class="preview-title">${escapeHtml(item.title)}</div>
      <div class="preview-meta">${escapeHtml(item.meta)}</div>
      ${item.detail ? `<div class="preview-detail">${escapeHtml(item.detail)}</div>` : ""}
    </article>
  `;
}

function typeLabel(type) {
  return {
    cylinder: "气缸",
    axis: "轴"
  }[type] || type || "执行器";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
