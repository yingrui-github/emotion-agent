// 星盘 AI 解读的提示词素材：六个解读方向，以及把 chart 写成文本的那几段。
//
// 这里不发请求 —— 请求、输出解析与追问都在 lib/aiReading.js，那边按 moduleId
// 取下面的 ASTRO_PROFILE。反向依赖会成环，所以本文件不要 import aiReading。
//
// 和八字不同，一张星盘的全文才七百字上下，按方向裁剪省不下多少，反而容易把模型
// 需要的旁证切掉（问事业也得看月亮、看相位）。所以每个方向都给全盘，再追加一段
// 【本次重点】把该方向该先看的宫位与星体拎出来。

/** 宫位含义。只用于把重点宫位写成人话，模型不必自己记宫位体系。 */
export const HOUSE_MEANING = {
  1: "自我与外在形象",
  2: "金钱与价值感",
  3: "沟通与学习",
  4: "家庭与根基",
  5: "恋爱与创造",
  6: "日常工作与健康",
  7: "婚姻与长期伙伴",
  8: "共有资源与深层转化",
  9: "远方与信念",
  10: "事业与社会定位",
  11: "人际与资源网络",
  12: "潜意识与隐性消耗",
};

/**
 * 六个解读方向。houses / planets 声明该方向的【本次重点】拎哪些宫位和星体。
 * 改动 key 或 label 时记得同步 components/AstroChart.jsx 里的按钮列表。
 */
const TOPICS = {
  chart: {
    label: "星盘",
    prompt:
      "这张盘整体的性格底色与能量结构：日月升三者各自代表的部分是配合还是互相拉扯、元素与三分法的偏向说明他习惯用什么方式应对世界、哪些部分是天生的长板",
  },
  aspect: {
    label: "相位",
    prompt:
      "盘里最紧的那几组相位各自意味着什么、哪些是现成的助力、哪些是反复出现的课题，以及它们合起来构成什么样的内在动力",
  },
  career: {
    label: "事业",
    prompt: "事业发展方向：适合的领域与角色、天然的优势、容易卡住的地方与突破的抓手",
    houses: [10, 6, 2],
    planets: ["太阳", "土星", "木星"],
  },
  marriage: {
    label: "婚姻",
    prompt: "婚姻与亲密关系：会被什么样的人吸引、在关系里的相处模式、需要面对的课题",
    houses: [7, 5, 8],
    planets: ["月亮", "金星", "火星"],
  },
  wealth: {
    label: "财富",
    prompt: "财富状况：赚钱的路数与金钱观、适合的积累方式、容易漏财或踩坑的地方",
    houses: [2, 8, 11],
    planets: ["金星", "木星", "土星"],
  },
  health: {
    label: "健康",
    prompt: "健康需要留意的方面：体质倾向、容易消耗在哪里、作息与保养上值得调整的地方",
    houses: [6, 12, 1],
    planets: ["太阳", "月亮", "土星"],
  },
};

const motionText = (motion) => (motion === "逆" ? "，逆行" : motion === "留" ? "，留" : "");

/** 「双子 26°23′（风象·变动）」—— 元素和三分法直接写出来，模型不用自己查星座属性。 */
export const positionText = (p) => `${p.sign} ${p.degree}（${p.element}象·${p.modality}）`;

export const planetLine = (p) => `- ${p.name}：${positionText(p)}，第 ${p.house} 宫${motionText(p.motion)}`;

const distText = (title, dist) => {
  const items = dist.items.map((i) => `${i.name} ${i.score}（${i.percent}%）`).join("，");
  const missing = dist.missing.length ? `；缺 ${dist.missing.join("、")}` : "";
  return `${title}：${items}${missing}`;
};

/** 每个方向都给的全盘文本。合盘（lib/synastryReading.js）两侧各走一遍这个。 */
export function chartSections(chart) {
  const { bigThree, planets, angles, houses, aspects } = chart;

  const basic = [
    `【命主】`,
    `出生：公历 ${chart.solar}（${chart.timezone}），${chart.city.name}`,
    chart.timeShifted ? `注：填写的时刻当天因夏令时不存在，已顺延 1 小时` : "",
    `宫位制：${houses.system}（回归黄道，含岁差与章动）`,
  ]
    .filter(Boolean)
    .join("\n");

  const three = [
    `【三要素】`,
    `太阳：${positionText(bigThree.sun)}，第 ${bigThree.sun.house} 宫`,
    `月亮：${positionText(bigThree.moon)}，第 ${bigThree.moon.house} 宫`,
    `上升：${positionText(bigThree.asc)}`,
  ].join("\n");

  const planetText = `【十行星】\n${planets.map(planetLine).join("\n")}`;

  const angleText = `【四轴】${angles.map((a) => `${a.name} ${a.sign} ${a.degree}`).join("，")}`;

  const cuspText = `【十二宫头】\n${houses.cusps
    .map((c) => `- 第 ${c.house} 宫（${HOUSE_MEANING[c.house]}）：${c.sign} ${c.degree}`)
    .join("\n")}`;

  const aspectText = aspects.length
    ? `【相位】（按容许度从紧到松，容许度越小力度越强）\n${aspects
        .map((a) => `- ${a.a} ${a.type} ${a.b}，容许度 ${a.orb}°`)
        .join("\n")}`
    : `【相位】容许度内没有成相的组合`;

  const distribution = [
    `【分布】（十行星各 1 分 + 上升 1 分，共 ${chart.elements.total} 分）`,
    distText("元素", chart.elements),
    distText("三分法", chart.modalities),
  ].join("\n");

  return [basic, three, planetText, angleText, cuspText, aspectText, distribution];
}

/** 该方向该先看的宫位与星体。宫位带上落在里面的行星，省得模型自己对一遍表。 */
function focusSection(topic, chart) {
  if (!topic.houses && !topic.planets) return "";

  const lines = [];

  for (const house of topic.houses ?? []) {
    const cusp = chart.houses.cusps.find((c) => c.house === house);
    const inside = chart.planets.filter((p) => p.house === house);
    const occupants = inside.length
      ? inside.map((p) => `${p.name} ${p.sign} ${p.degree}${motionText(p.motion)}`).join("、")
      : "无行星落入，看宫头星座与其守护星";
    lines.push(`- 第 ${house} 宫（${HOUSE_MEANING[house]}）宫头 ${cusp.sign} ${cusp.degree}；宫内：${occupants}`);
  }

  for (const name of topic.planets ?? []) {
    const p = chart.planets.find((it) => it.name === name);
    if (p) lines.push(planetLine(p));
  }

  return `【本次重点】\n${lines.join("\n")}`;
}

export const ASTRO_PROFILE = {
  persona: "专业占星师",
  chartLabel: "本命星盘排盘结果",
  topics: TOPICS,
  terms: "可以使用占星术语（如上升、宫位、相位、守护星、元素与三分法等）",
  noMakeUp: "比如没给行运与推运就不要谈具体年份，没给月交点与小行星就不要提它们",
  hasChart: (chart) => Boolean(chart?.planets && chart?.houses),
  buildContext: (topic, chart) =>
    [...chartSections(chart), focusSection(topic, chart)].filter(Boolean).join("\n\n"),
};
