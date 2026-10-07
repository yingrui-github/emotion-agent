// 关系合盘 AI 解读的提示词素材：四个解读方向，以及把合盘写成文本的那几段。
//
// 两侧的本命盘直接复用 lib/astroReading.js 的 chartSections —— 合盘不需要第二套
// chart→文本。本文件同样不要 import aiReading（会成环）。
//
// 合盘的信息量是单盘的两倍多，但仍然每个方向都给全部：跨盘相位要配合双方各自的
// 盘才读得出来（对方的土星压在我的月亮上，得先知道我的月亮本来是什么状态）。

import { chartSections, HOUSE_MEANING, planetLine } from "./astroReading.js";

/**
 * 四个解读方向。planets / houses 声明该方向的【本次重点】从跨盘相位与落宫叠加里
 * 拎哪些星体和宫位。改动 key 或 label 时记得同步 components/SynastryChart.jsx。
 */
const TOPICS = {
  overall: {
    label: "整体",
    prompt:
      "这两张盘放在一起整体是什么质地：双方的日月升各自是同类还是互补、跨盘相位里和谐与紧张的比重说明这段关系的基调、它最像哪一类关系",
  },
  attraction: {
    label: "吸引",
    prompt:
      "吸引力从哪里来：是谁在吸引谁、吸引的是对方的哪一面、这种吸引是持续的还是一阵的",
    planets: ["金星", "火星", "太阳", "月亮"],
    houses: [5, 7, 8],
  },
  friction: {
    label: "摩擦",
    prompt:
      "摩擦集中在哪里：最容易反复争执的议题、各自踩到对方哪根弦、这些紧张是可消化的还是结构性的",
    planets: ["土星", "火星", "天王星"],
  },
  longterm: {
    label: "长期",
    prompt: "长期走下去的样子：关系里的稳定项与消耗项、双方在生活与现实层面的配合度、要长久需要各自补上什么",
    planets: ["土星", "月亮", "太阳"],
    houses: [4, 7, 10],
  },
};

/** 「你的太阳 刑 对方的月亮，容许度 2.1°」—— 方向写进文本，否则模型读不出是谁压着谁。 */
const crossLine = (x) => `- 你的${x.a} ${x.type} 对方的${x.b}，容许度 ${x.orb}°`;

const overlayLine = (p) =>
  `- ${p.name} ${p.sign} ${p.degree}，落在第 ${p.house} 宫（${HOUSE_MEANING[p.house]}）`;

function crossSection(cross) {
  if (!cross.length) return "【跨盘相位】容许度内没有成相的组合";
  return `【跨盘相位】（按容许度从紧到松，容许度越小力度越强）\n${cross
    .map(crossLine)
    .join("\n")}`;
}

function overlaySection(overlay) {
  return [
    `【落宫叠加】对方的行星落在你的宫位里（用你的本命宫头算）\n${overlay.bInA
      .map(overlayLine)
      .join("\n")}`,
    `【落宫叠加】你的行星落在对方的宫位里（用对方的本命宫头算）\n${overlay.aInB
      .map(overlayLine)
      .join("\n")}`,
  ].join("\n\n");
}

function countsSection(counts) {
  const items = counts.items.map((i) => `${i.name} ${i.score}（${i.percent}%）`).join("，");
  return `【相位构成】共 ${counts.total} 组：${items}`;
}

/**
 * 该方向该先看的跨盘相位与落宫。只筛不加料 —— 没有符合条件的就直说，
 * 否则模型会拿一条勉强沾边的相位当重点讲。
 */
function focusSection(topic, chart) {
  if (!topic.planets && !topic.houses) return "";

  const names = topic.planets ?? [];
  const lines = [];

  if (names.length) {
    const hits = chart.cross.filter((x) => names.includes(x.a) || names.includes(x.b));
    lines.push(
      hits.length
        ? `涉及 ${names.join("、")} 的跨盘相位：\n${hits.map(crossLine).join("\n")}`
        : `涉及 ${names.join("、")} 的跨盘相位：没有成相的组合`,
    );

    // 双方各自盘里这几颗星本来的状态 —— 跨盘相位只给了两端的名字，没有度数与落宫。
    for (const [side, one] of [
      ["你", chart.a],
      ["对方", chart.b],
    ]) {
      const own = names.map((n) => one.planets.find((p) => p.name === n)).filter(Boolean);
      if (own.length) lines.push(`${side}的本命位置：\n${own.map(planetLine).join("\n")}`);
    }
  }

  for (const house of topic.houses ?? []) {
    const inside = chart.overlay.bInA.filter((p) => p.house === house);
    const mine = chart.overlay.aInB.filter((p) => p.house === house);
    const text = (list) =>
      list.length ? list.map((p) => `${p.name} ${p.sign} ${p.degree}`).join("、") : "无";
    lines.push(
      `第 ${house} 宫（${HOUSE_MEANING[house]}）：对方落进你这一宫的有 ${text(inside)}；你落进对方这一宫的有 ${text(mine)}`,
    );
  }

  return `【本次重点】\n${lines.join("\n")}`;
}

export const SYNASTRY_PROFILE = {
  persona: "专业占星师",
  chartLabel: "两个人的星盘合盘结果",
  topics: TOPICS,
  terms: "可以使用占星术语（如上升、宫位、相位、落宫叠加、元素与三分法等）",
  noMakeUp: "比如没给组合盘与月交点就不要提它们，也不要给这段关系打分或断定能不能长久",
  hasChart: (chart) => Boolean(chart?.a?.planets && chart?.b?.planets && chart?.cross),
  buildContext: (topic, chart) =>
    [
      `【说明】下面是两个人各自的本命盘，以及两张盘之间的交互。「你」指第一个人（A 方），「对方」指第二个人（B 方）。`,
      `========== 你的本命盘 ==========`,
      ...chartSections(chart.a),
      `========== 对方的本命盘 ==========`,
      ...chartSections(chart.b),
      `========== 两张盘之间 ==========`,
      crossSection(chart.cross),
      countsSection(chart.counts),
      overlaySection(chart.overlay),
      focusSection(topic, chart),
    ]
      .filter(Boolean)
      .join("\n\n"),
};
