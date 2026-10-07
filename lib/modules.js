// 3 个子功能模块的元数据。
//
// 这里是模块的唯一数据源：首页卡片、导航、动态路由、子页面标题都从这里读取。
// 新增模块只需在 MODULES 里追加一项，页面会自动跟随。
//
// 可选字段：submitLabel / pendingLabel / resultLabel —— 覆盖按钮与结果区的默认文案。

/**
 * @typedef {Object} ModuleInput
 * @property {string} name  表单字段名
 * @property {string} label 展示用 label
 * @property {string} type  input 类型；"select" 时读 options
 * @property {string} hint  placeholder
 * @property {(string | {value: string, label: string})[]} [options]
 *           type 为 select 时的候选值；要让显示文案和提交值不同时用对象形式
 * @property {string} [inputMode] 透传给 input 的 inputmode，例如 "numeric" 让手机弹数字键盘
 * @property {string} [group] 同 group 的相邻字段横排成一行（例如生辰的年月日）
 * @property {string} [groupLabel] 一组字段的总标题，写在该组第一项上
 */

/**
 * 时柱下拉：十二时辰，提交该时辰的起始整点。
 * 子时跨零点，这里按 23:00 算（晚子时）—— 0:00—1:00 出生的人时干会差一位。
 */
const HOUR_OPTIONS = [
  ["子", 23],
  ["丑", 1],
  ["寅", 3],
  ["卯", 5],
  ["辰", 7],
  ["巳", 9],
  ["午", 11],
  ["未", 13],
  ["申", 15],
  ["酉", 17],
  ["戌", 19],
  ["亥", 21],
].map(([zhi, start]) => ({
  value: String(start),
  label: `${start}:00-${(start + 2) % 24}:00 ${zhi}时`,
}));

/**
 * 合盘一侧的五个生辰字段。两侧字段同名会撞，所以加 a / b 前缀 ——
 * lib/synastry.js 的 sideForm 按同一套规则拆回 castAstroChart 认的名字。
 */
function sideInputs(prefix, groupLabel, yearHint) {
  const name = (field) => `${prefix}${field[0].toUpperCase()}${field.slice(1)}`;
  const group = `birth${prefix.toUpperCase()}`;
  return [
    {
      name: name("birthYear"),
      label: "年",
      type: "text",
      hint: yearHint,
      inputMode: "numeric",
      group,
      groupLabel,
    },
    { name: name("birthMonth"), label: "月", type: "text", hint: "6", inputMode: "numeric", group },
    { name: name("birthDay"), label: "日", type: "text", hint: "18", inputMode: "numeric", group },
    {
      name: name("birthTime"),
      label: "时",
      type: "text",
      hint: "9:30",
      inputMode: "numeric",
      format: "time",
      group,
      width: "w-20",
    },
    { name: name("birthPlace"), label: "城市", type: "text", hint: "例如：上海", group, width: "w-28" },
  ];
}

export const MODULES = [
  {
    id: "bazi",
    name: "命盘解读",
    tagline: "八字 · 五行 · 十神",
    desc: "以出生时间推演命盘，看清天赋底色、性格结构与人生节奏。",
    accent: "#e0a458",
    glyph: "☯",
    inputs: [
      {
        name: "birthYear",
        label: "年",
        type: "text",
        hint: "1990",
        inputMode: "numeric",
        group: "birth",
        groupLabel: "生辰",
      },
      { name: "birthMonth", label: "月", type: "text", hint: "5", inputMode: "numeric", group: "birth" },
      { name: "birthDay", label: "日", type: "text", hint: "20", inputMode: "numeric", group: "birth" },
      { name: "birthHour", label: "时", type: "select", hint: "", options: HOUR_OPTIONS, group: "birth" },
      { name: "gender", label: "性别", type: "select", hint: "", options: ["男", "女"] },
      { name: "birthPlace", label: "出生地", type: "text", hint: "例如：北京市海淀区" },
    ],
    inputLabel: "输入生辰",
    submitLabel: "进行排盘",
    pendingLabel: "排盘中…",
    resultLabel: "排盘",
    samples: ["我的命盘里最突出的天赋是什么？", "今年的感情运势怎么走？"],
  },
  {
    id: "astro",
    name: "星盘解读",
    tagline: "星座 · 宫位 · 相位",
    desc: "用本命星盘解析你的情感模式、亲密需求与关系课题。",
    accent: "#7c8cf8",
    glyph: "✶",
    inputs: [
      {
        name: "birthYear",
        label: "年",
        type: "text",
        hint: "1995",
        inputMode: "numeric",
        group: "birth",
        groupLabel: "生辰",
      },
      { name: "birthMonth", label: "月", type: "text", hint: "6", inputMode: "numeric", group: "birth" },
      { name: "birthDay", label: "日", type: "text", hint: "18", inputMode: "numeric", group: "birth" },
      // 分钟不能省：上升点每 4 分钟走约 1°，取整到小时会换一个星座。
      {
        name: "birthTime",
        label: "时",
        type: "text",
        hint: "9:30",
        inputMode: "numeric",
        // 用户连着敲数字就行，ModuleView 会补成 hh:mm。
        format: "time",
        group: "birth",
        width: "w-20",
      },
      { name: "birthPlace", label: "出生城市", type: "text", hint: "例如：上海" },
    ],
    inputLabel: "输入生辰",
    submitLabel: "排星盘",
    pendingLabel: "排盘中…",
    resultLabel: "星盘",
    samples: ["我的金星落在哪里，说明什么？", "我在关系里为什么容易回避？"],
  },
  {
    id: "synastry",
    name: "关系合盘",
    tagline: "相位 · 落宫 · 叠加",
    desc: "把两个人的本命星盘放在一起，看吸引从哪来、摩擦卡在哪。",
    accent: "#f472b6",
    glyph: "∞",
    inputs: [...sideInputs("a", "你的生辰", "1995"), ...sideInputs("b", "对方的生辰", "1993")],
    inputLabel: "输入双方生辰",
    submitLabel: "开始合盘",
    pendingLabel: "合盘中…",
    resultLabel: "合盘",
    samples: ["我们之间的吸引力从哪来？", "这段关系最容易卡在哪？"],
  },
];

const MODULE_BY_ID = new Map(MODULES.map((m) => [m.id, m]));

export function getModule(id) {
  return MODULE_BY_ID.get(id) ?? null;
}

/**
 * 把 accent 拿去当文字色时用这个包一层。
 *
 * accent 是按深色底调的中间调，直接放到浅色底上对比度不够。--accent-shade 在
 * 深色主题是 0%（等于原色）、浅色主题是 28%，见 app/globals.css。
 * 纯装饰用途（边框、低透明度背景、渐变按钮底色）不需要，直接用原色。
 */
export function accentText(accent) {
  return `color-mix(in oklab, ${accent}, black var(--accent-shade))`;
}
