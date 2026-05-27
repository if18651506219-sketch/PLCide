const STORAGE_KEY = "plc-ai-ide-demo-state-v1";
const PROJECT_FILE_VERSION = "plc-ai-ide-project-v1";
const VARIABLE_EXCEL_VERSION = "plc-ai-ide-variable-table-v1";

const projectData = {
  system: {
    id: "system",
    name: "系统站",
    systemConditions: [
      { id: "startBtn", name: "启动按钮信号", address: "IX2.0", expression: "StartBtn" },
      { id: "stopBtn", name: "停止按钮常闭", address: "IX2.1", expression: "NOT StopBtn", defaultContact: "NC" },
      { id: "resetBtn", name: "复位按钮信号", address: "IX2.2", expression: "ResetBtn" },
      { id: "hmiEstop", name: "HMI急停常闭", address: "IX2.4", expression: "NOT HMI_EStop", defaultContact: "NC" },
      { id: "airOk", name: "气源监测信号", address: "IX2.7", expression: "Air_OK" },
      { id: "estopRelay", name: "急停安继OK", address: "IX3.0/IX3.1", expression: "EStopRelay_OK" },
      { id: "doorRelay", name: "安全门安继OK", address: "IX3.2/IX3.3", expression: "DoorRelay_OK" },
      { id: "frontDoor", name: "前门关闭并锁定", address: "IX6.0/IX6.1", expression: "FrontDoor_OK" },
      { id: "twoHand1", name: "双手启动信号1", address: "IX4.0", expression: "TwoHand_1" },
      { id: "twoHand2", name: "双手启动信号2", address: "IX4.1", expression: "TwoHand_2" }
    ],
    timers: [
      { id: "delayT1", name: "T1 延时导通", type: "delay", defaultMs: 2000 },
      { id: "delayT2", name: "T2 延时导通", type: "delay", defaultMs: 1000 }
    ]
  },
  stations: [
    {
      id: "station1",
      name: "站1_热套移载工位",
      actuators: [
        {
          id: "cylStatorClamp",
          type: "cylinder",
          name: "定子夹爪气缸",
          actions: [
            { id: "home", label: "初始位", command: "定子夹爪气缸.初始位 := TRUE", done: "定子夹爪气缸.初始位DONE" },
            { id: "work", label: "工作位", command: "定子夹爪气缸.工作位 := TRUE", done: "定子夹爪气缸.工作位DONE" }
          ]
        },
        {
          id: "axisMT0",
          type: "axis",
          name: "MT0移载X轴",
          actions: [
            { id: "p1", label: "P1安全位", command: "MT0移载X轴.GO.1 := TRUE", done: "MT0移载X轴.DONE.1" },
            { id: "p2", label: "P2人工上下料位", command: "MT0移载X轴.GO.2 := TRUE", done: "MT0移载X轴.DONE.2" },
            { id: "p3", label: "P3加热位", command: "MT0移载X轴.GO.3 := TRUE", done: "MT0移载X轴.DONE.3" },
            { id: "p4", label: "P4定子取料位", command: "MT0移载X轴.GO.4 := TRUE", done: "MT0移载X轴.DONE.4" },
            { id: "p5", label: "P5热套位", command: "MT0移载X轴.GO.5 := TRUE", done: "MT0移载X轴.DONE.5" }
          ]
        },
        {
          id: "axisMT1",
          type: "axis",
          name: "MT1上顶Z轴",
          actions: [
            { id: "p1", label: "P1安全位", command: "MT1上顶Z轴.GO.1 := TRUE", done: "MT1上顶Z轴.DONE.1" },
            { id: "p2", label: "P2取料等待位", command: "MT1上顶Z轴.GO.2 := TRUE", done: "MT1上顶Z轴.DONE.2" },
            { id: "p3", label: "P3加热位1", command: "MT1上顶Z轴.GO.3 := TRUE", done: "MT1上顶Z轴.DONE.3" },
            { id: "p4", label: "P4加热位1循环", command: "MT1上顶Z轴.GO.4 := TRUE", done: "MT1上顶Z轴.DONE.4" },
            { id: "p5", label: "P5加热位2循环", command: "MT1上顶Z轴.GO.5 := TRUE", done: "MT1上顶Z轴.DONE.5" }
          ]
        },
        {
          id: "pressHeat",
          type: "press",
          name: "热套压机",
          actions: [
            { id: "home", label: "回原点", command: "热套压机.GO.1 := TRUE", done: "热套压机.DONE.1" },
            { id: "pick", label: "取定子", command: "热套压机.GO.2 := TRUE", done: "热套压机.DONE.2" },
            { id: "assembly", label: "热套组装", command: "热套压机.GO.3 := TRUE", done: "热套压机.DONE.3" }
          ]
        },
        {
          id: "coolFan",
          type: "fan",
          name: "冷却吹风",
          actions: [
            { id: "on", label: "启动", command: "冷却吹风 := TRUE", done: "T_冷却完成.Q" },
            { id: "off", label: "关闭", command: "冷却吹风 := FALSE", done: "TRUE" }
          ]
        }
      ],
      sensors: [
        { id: "twoHand1", name: "双手启动信号1", address: "IX4.0", expression: "TwoHand_1" },
        { id: "twoHand2", name: "双手启动信号2", address: "IX4.1", expression: "TwoHand_2" },
        { id: "heatHasPart", name: "加热位有料感应_对射", address: "IX207.6", expression: "HeatPart_Present" },
        { id: "pressHasPart", name: "热套位有料感应_对射", address: "IX207.7", expression: "PressPart_Present" },
        { id: "shellTrayProof1", name: "壳体托盘防呆信号1", address: "IX238.0", expression: "ShellTray_Proof_1" },
        { id: "shellTrayProof2", name: "壳体托盘防呆信号2", address: "IX238.1", expression: "ShellTray_Proof_2" },
        { id: "shellTrayReady1", name: "壳体托盘到位感应1", address: "IX238.4", expression: "ShellTray_Ready_1" },
        { id: "shellTrayReady2", name: "壳体托盘到位感应2", address: "IX238.5", expression: "ShellTray_Ready_2" },
        { id: "statorTrayProof1", name: "定子托盘防呆信号1", address: "IX239.0", expression: "StatorTray_Proof_1" },
        { id: "statorTrayProof2", name: "定子托盘防呆信号2", address: "IX239.1", expression: "StatorTray_Proof_2" }
      ]
    },
    {
      id: "station2",
      name: "站2_加热工位",
      actuators: [
        {
          id: "thermoCyl1",
          type: "cylinder",
          name: "热电偶伸缩气缸1",
          actions: [
            { id: "home", label: "初始位", command: "热电偶伸缩气缸1BK := TRUE", done: "热电偶伸缩气缸1HP" },
            { id: "work", label: "工作位", command: "热电偶伸缩气缸1GO := TRUE", done: "热电偶伸缩气缸1WP" }
          ]
        },
        {
          id: "thermoCyl2",
          type: "cylinder",
          name: "热电偶伸缩气缸2",
          actions: [
            { id: "home", label: "初始位", command: "热电偶伸缩气缸2BK := TRUE", done: "热电偶伸缩气缸2HP" },
            { id: "work", label: "工作位", command: "热电偶伸缩气缸2GO := TRUE", done: "热电偶伸缩气缸2WP" }
          ]
        },
        {
          id: "heater1",
          type: "heater",
          name: "一号欧感加热",
          actions: [
            { id: "start", label: "启动加热", command: "一号欧感加热_启动 := TRUE", done: "一号欧感加热_温度到达输出" },
            { id: "stop", label: "停止加热", command: "一号欧感加热_启动 := FALSE", done: "TRUE" },
            { id: "estop", label: "加热急停", command: "一号欧感加热_急停 := TRUE", done: "TRUE" }
          ]
        }
      ],
      sensors: [
        { id: "heaterFault", name: "一号欧感加热_故障输出", address: "IX4.2", expression: "Heater1_Fault", defaultContact: "NC" },
        { id: "heaterRun", name: "一号欧感加热_运行输出", address: "IX4.3", expression: "Heater1_Running" },
        { id: "heaterTempOk", name: "一号欧感加热_温度到达输出", address: "IX4.4", expression: "Heater1_Temp_OK" },
        { id: "chillerAlarm", name: "水冷机报警", address: "IX4.5", expression: "Chiller_Alarm", defaultContact: "NC" }
      ]
    }
  ]
};

const DEFAULT_PROJECT_DATA = JSON.parse(JSON.stringify(projectData));
