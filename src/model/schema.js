export const modelSections = [
  { id: "project", label: "项目名称" },
  { id: "stations", label: "站名称" },
  { id: "actuatorClasses", label: "执行器类" },
  { id: "actuatorInstances", label: "执行器实例" },
  { id: "sensors", label: "传感器" },
  { id: "timers", label: "定时器" },
  { id: "systemVariables", label: "系统变量" },
  { id: "localVariables", label: "局部变量" },
  { id: "globalVariables", label: "全局变量" },
  { id: "programFlow", label: "程序流" },
  { id: "codePreview", label: "代码预览" }
];

export const tableSchemas = {
  project: {
    title: "项目名称",
    collection: null,
    columns: [{ key: "projectName", label: "项目名称", width: 280 }]
  },
  stations: {
    title: "站名称",
    collection: "stations",
    columns: [
      { key: "id", label: "站ID", width: 180, required: true },
      { key: "name", label: "站名称", width: 240, required: true }
    ]
  },
  actuatorClasses: {
    title: "执行器类",
    collection: "actuatorClasses",
    columns: [
      { key: "id", label: "类ID", width: 160, required: true },
      { key: "name", label: "类名称", width: 160, required: true },
      { key: "defaultTargets", label: "默认目标列表", width: 260, required: true },
      { key: "structTemplate", label: "结构体内容", width: 320, multiline: true },
      { key: "executeTemplate", label: "执行范例", width: 280, required: true },
      { key: "doneTemplate", label: "完成判断范例", width: 280, required: true }
    ]
  },
  actuatorInstances: {
    title: "执行器实例",
    collection: "actuatorInstances",
    columns: [
      { key: "stationId", label: "所属站", width: 150, required: true },
      { key: "classId", label: "执行器类", width: 150, required: true },
      { key: "id", label: "实例ID", width: 180, required: true },
      { key: "name", label: "实例名", width: 220, required: true },
      { key: "targets", label: "目标列表", width: 300, required: true },
      { key: "executeTemplate", label: "执行范例覆盖", width: 280 },
      { key: "doneTemplate", label: "完成判断覆盖", width: 280 }
    ]
  },
  sensors: variableSchema("传感器", true),
  timers: {
    title: "定时器",
    collection: "timers",
    columns: [
      { key: "stationId", label: "所属站", width: 150, required: true },
      { key: "id", label: "定时器ID", width: 220, required: true },
      { key: "name", label: "名称", width: 200, required: true },
      { key: "defaultMs", label: "默认时间ms", width: 150, numeric: true }
    ]
  },
  systemVariables: variableSchema("系统变量", false),
  localVariables: variableSchema("局部变量", true),
  globalVariables: variableSchema("全局变量", false)
};

function variableSchema(title, withStation) {
  return {
    title,
    collection: `${sectionCollection(title)}`,
    columns: [
      ...(withStation ? [{ key: "stationId", label: "所属站", width: 150, required: true }] : []),
      { key: "id", label: "变量ID", width: 180, required: true },
      { key: "name", label: "名称", width: 220, required: true },
      { key: "type", label: "类型", width: 110 },
      { key: "address", label: "地址", width: 160 },
      { key: "expression", label: "表达式", width: 220 },
      { key: "comment", label: "备注", width: 240 }
    ]
  };
}

function sectionCollection(title) {
  return {
    "传感器": "sensors",
    "系统变量": "systemVariables",
    "局部变量": "localVariables",
    "全局变量": "globalVariables"
  }[title];
}
