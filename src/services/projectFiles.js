const V2_PROJECT_FILE = "plc-ai-ide-v2-project-model";
const V2_DRAFT_KEY = "plc-ai-ide-v2-draft";

export function createProjectFile(model) {
  return {
    fileType: V2_PROJECT_FILE,
    version: 1,
    exportedAt: new Date().toISOString(),
    model
  };
}

export function saveV2ProjectFile(model) {
  downloadJson(`PLCide-v2-model-${new Date().toISOString().slice(0, 10)}.json`, createProjectFile(model));
}

export function readProjectFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(parseProjectFile(String(reader.result || "")));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsText(file, "utf-8");
  });
}

export function parseProjectFile(text) {
  const payload = JSON.parse(text);
  if (payload?.fileType === V2_PROJECT_FILE && payload.model) return payload.model;
  if (payload?.projectName && Array.isArray(payload.stations)) return payload;
  throw new Error("Invalid V2 project file");
}

export function loadDraftModel() {
  try {
    const payload = JSON.parse(localStorage.getItem(V2_DRAFT_KEY) || "null");
    return payload?.model || null;
  } catch {
    return null;
  }
}

export function saveDraftModel(model) {
  localStorage.setItem(V2_DRAFT_KEY, JSON.stringify({
    fileType: V2_PROJECT_FILE,
    savedAt: new Date().toISOString(),
    model
  }));
}

export function clearDraftModel() {
  localStorage.removeItem(V2_DRAFT_KEY);
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
