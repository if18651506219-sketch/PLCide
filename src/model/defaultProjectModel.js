export function defaultProjectModel() {
  return {
    projectName: "热套压机项目",
    stations: [
      { id: "station1", name: "站1_热套移载工位" },
      { id: "station2", name: "站2_加热工位" }
    ],
    actuatorClasses: [
      {
        id: "cylinder",
        name: "气缸",
        defaultTargets: "初始位，工作位",
        structTemplate: "初始位 : BOOL\n工作位 : BOOL\n初始位DONE : BOOL\n工作位DONE : BOOL",
        executeTemplate: "{实例名}.{目标名} := TRUE",
        doneTemplate: "{实例名}.{目标名}DONE"
      },
      {
        id: "axis",
        name: "轴",
        defaultTargets: "P1安全位，P2等待位，P3工作位",
        structTemplate: "GO : ARRAY[1..目标数量] OF BOOL\nDONE : ARRAY[1..目标数量] OF BOOL",
        executeTemplate: "{实例名}.GO.{目标序号} := TRUE",
        doneTemplate: "{实例名}.DONE.{目标序号}"
      }
    ],
    actuatorInstances: [
      { stationId: "station1", classId: "cylinder", id: "cylStatorClamp", name: "定子夹爪气缸", targets: "初始位，工作位", executeTemplate: "", doneTemplate: "" },
      { stationId: "station1", classId: "axis", id: "axisMT0", name: "MT0移载X轴", targets: "P1安全位，P2人工上下料位，P3加热位，P4定子取料位，P5热套位", executeTemplate: "", doneTemplate: "" },
      { stationId: "station1", classId: "axis", id: "axisMT1", name: "MT1上顶Z轴", targets: "P1安全位，P2取料等待位，P3加热位1，P4加热位1循环，P5加热位2循环", executeTemplate: "", doneTemplate: "" }
    ],
    sensors: [
      { stationId: "station1", id: "twoHand1", name: "双手启动信号1", type: "BOOL", address: "IX4.0", expression: "TwoHand_1", comment: "" },
      { stationId: "station1", id: "twoHand2", name: "双手启动信号2", type: "BOOL", address: "IX4.1", expression: "TwoHand_2", comment: "" },
      { stationId: "station1", id: "heatHasPart", name: "加热位有料感应_对射", type: "BOOL", address: "IX207.6", expression: "HeatPart_Present", comment: "" }
    ],
    timers: [
      ...stationTimers("station1"),
      ...stationTimers("station2")
    ],
    systemVariables: [
      { id: "startBtn", name: "启动按钮信号", type: "BOOL", address: "IX2.0", expression: "StartBtn", comment: "" },
      { id: "stopBtn", name: "停止按钮常闭", type: "BOOL", address: "IX2.1", expression: "NOT StopBtn", comment: "NC" },
      { id: "resetBtn", name: "复位按钮信号", type: "BOOL", address: "IX2.2", expression: "ResetBtn", comment: "" }
    ],
    localVariables: [],
    globalVariables: [
      { id: "globalVar1", name: "全局变量1", type: "BOOL", address: "GVL.全局变量1", expression: "全局变量1", comment: "" }
    ],
    programs: {
      station1: [
        { step: 10, note: "移载到加热位", actions: "axisMT0:P3加热位", condition: "", timeoutMs: 8000, nextStep: 20 },
        { step: 20, note: "上顶到加热位", actions: "axisMT1:P3加热位1", condition: "", timeoutMs: 8000, nextStep: 0 }
      ],
      station2: []
    }
  };
}

export function stationTimers(stationId) {
  const timers = [{ stationId, id: `${stationId}_flowTimer`, name: "流程定时器", defaultMs: 1000 }];
  for (let index = 1; index <= 10; index += 1) {
    timers.push({ stationId, id: `${stationId}_alarmTimer${index}`, name: `报警定时器${index}`, defaultMs: 5000 });
  }
  return timers;
}
