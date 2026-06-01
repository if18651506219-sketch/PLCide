function generateCode(stationId = state.currentStationId) {
  const station = getStation(stationId);
  const work = getWork(stationId);
  ensureStepSystemNumbers(work);
  const lines = [];
  lines.push(`// ${station.name} - PLC-AI IDE Demo 生成预览`);
  lines.push("// 代码由本地规则模板生成，保持流程、条件与动作的主体逻辑。");
  lines.push("");
  lines.push("CASE Step OF");
  lines.push("    0:");
  lines.push(`        Step := ${work.steps.length ? getStepSystemNo(work.steps[0], 0) : 0};`);
  lines.push("");

  work.steps.forEach((step, index) => {
    const stepNo = getStepSystemNo(step, index);
    const nextStep = getNextStepSystemNo(work, index);
    const conditionLogic = step.hasConditionBox ? (step.compiledLogic || toLogicExpression(collectStepConditions(step))) : "";
    const waitLogic = step.actions
      .filter((action) => action.waitDone !== false)
      .map((action) => action.done)
      .filter(Boolean)
      .filter((done) => done !== "TRUE")
      .join(" AND ");
    const hasCompiledCoils = Array.isArray(step.compiledCoils) && step.compiledCoils.length;
    const finalLogic = [conditionLogic, waitLogic].filter(Boolean).join(" AND ") || "TRUE";
    lines.push(`    ${stepNo}:`);
    if (step.comment) lines.push(`        // 注释: ${step.comment}`);
    lines.push(`        // ${step.actions.map((action) => `${action.deviceName}->${action.actionLabel}`).join(" + ") || "空步骤"}`);
    if (hasCompiledCoils) {
      step.compiledCoils.forEach((coil, coilIndex) => {
        const coilName = `Step${stepNo}_Coil${coilIndex + 1}`;
        lines.push(`        // 梯形图线圈${coilIndex + 1}: 左侧逻辑 -> 输出`);
        lines.push(`        ${coilName} := ${coil.expression};`);
        lines.push(`        IF ${coilName} THEN`);
        lines.push(`            Step := ${coil.targetStepNo};`);
        lines.push("        END_IF;");
      });
    }
    step.actions.forEach((action) => lines.push(`        ${action.command};`));

    if (!hasCompiledCoils) {
      lines.push(`        IF ${finalLogic} THEN`);
      lines.push(`            Step := ${nextStep};`);
      lines.push("        END_IF;");
    }
    lines.push("");
  });
  lines.push("END_CASE;");
  return lines.join("\n");
}
