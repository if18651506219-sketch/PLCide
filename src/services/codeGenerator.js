import { splitTargets } from "../model/modelOps.js";

export function generateStationCode(model, stationId) {
  const station = model.stations.find((item) => item.id === stationId) || model.stations[0];
  if (!station) return "";
  const steps = [...(model.programs?.[station.id] || [])].sort((a, b) => Number(a.step) - Number(b.step));
  const lines = [
    `// ${station.name} - PLC-AI IDE V2 生成预览`,
    "// 参数模型与程序流表格生成，后续可接 AI 补全条件、超时和报警。",
    "",
    "CASE Step OF",
    "    0:",
    steps.length ? `        Step := ${Number(steps[0].step) || 10};` : "        ;",
    ""
  ];

  steps.forEach((step, index) => {
    const stepNo = Number(step.step) || (index + 1) * 10;
    const nextStep = step.nextStep === "" || step.nextStep == null ? nextStepNo(steps, index) : Number(step.nextStep) || 0;
    const actions = parseStepActions(step.actions).map((action) => resolveAction(model, station.id, action)).filter(Boolean);
    lines.push(`    ${stepNo}:`);
    if (step.note) lines.push(`        // ${step.note}`);
    actions.forEach((action) => lines.push(`        ${action.command};`));
    actions.forEach((action, actionIndex) => {
      const timerName = `T_${stepNo}_${action.actuatorId}_${actionIndex + 1}`.replace(/[^A-Za-z0-9_]/g, "_");
      const timeout = Number(step.timeoutMs) || 8000;
      lines.push(`        ${timerName}(IN := NOT (${action.done}), PT := T#${timeout}ms);`);
      lines.push(`        IF ${timerName}.Q THEN`);
      lines.push(`            AlarmText := '${escapeStString(action.label)}超时';`);
      lines.push("            Alarm := TRUE;");
      lines.push("            Step := 999;");
      lines.push("        END_IF;");
    });
    const doneExpression = actions.length ? actions.map((action) => action.done).join(" AND ") : "TRUE";
    const condition = String(step.condition || "").trim();
    const transitionCondition = condition ? `(${condition}) AND (${doneExpression})` : doneExpression;
    lines.push(`        IF ${transitionCondition} THEN`);
    lines.push(`            Step := ${nextStep};`);
    lines.push("        END_IF;");
    lines.push("");
  });

  lines.push("    999:");
  lines.push("        IF ResetBtn THEN");
  lines.push("            Alarm := FALSE;");
  lines.push("            Step := 0;");
  lines.push("        END_IF;");
  lines.push("END_CASE;");
  return lines.join("\n");
}

export function parseStepActions(value) {
  return String(value || "")
    .split(/[，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [actuatorId, targetName] = item.split(":").map((part) => part.trim());
      return { actuatorId, targetName };
    });
}

function resolveAction(model, stationId, actionRef) {
  const instance = model.actuatorInstances.find((item) => item.stationId === stationId && item.id === actionRef.actuatorId);
  if (!instance) return null;
  const klass = model.actuatorClasses.find((item) => item.id === instance.classId) || model.actuatorClasses[0];
  const targets = splitTargets(instance.targets);
  const targetIndex = Math.max(0, targets.findIndex((target) => target === actionRef.targetName));
  const targetName = targets[targetIndex] || actionRef.targetName || targets[0] || "动作1";
  const vars = {
    instanceName: instance.name,
    targetName,
    targetIndex: targetIndex + 1
  };
  const executeTemplate = instance.executeTemplate || klass.executeTemplate;
  const doneTemplate = instance.doneTemplate || klass.doneTemplate;
  return {
    actuatorId: instance.id,
    label: `${instance.name}${targetName}`,
    command: renderTemplate(executeTemplate, vars).replace(/[;；]+$/, ""),
    done: renderTemplate(doneTemplate, vars).replace(/[;；]+$/, "")
  };
}

function renderTemplate(template, vars) {
  return String(template || "")
    .replaceAll("{实例名}", vars.instanceName)
    .replaceAll("{目标名}", vars.targetName)
    .replaceAll("{目标序号}", String(vars.targetIndex))
    .trim();
}

function nextStepNo(steps, index) {
  return Number(steps[index + 1]?.step) || 0;
}

function escapeStString(value) {
  return String(value || "").replace(/'/g, "''");
}
