// 调用 AI 模型对排盘做专项解读。走 OpenAI 兼容的 /chat/completions 接口。
//
// 八字和星盘共用这里的请求、输出格式与追问流程，各自不同的部分（人设、术语、
// 解读方向、怎么把 chart 写成文本）收在 PROFILES 里按 moduleId 取。
//
// 八字的 prompt 按解读方向裁剪 chart：问大运就给大运表，问流年还要给流年和当前年份。
// 所有方向都给五行力量与身强身弱 —— 不给的话模型只能自己数藏干。
// 星盘那份在 lib/astroReading.js，全盘都给、再追加一段本次重点；
// 合盘那份在 lib/synastryReading.js，两侧本命盘复用星盘的 chartSections。

import { ASTRO_PROFILE } from "./astroReading.js";
import { SYNASTRY_PROFILE } from "./synastryReading.js";

const BASE_URL = process.env.AI_READING_BASE_URL;
const API_KEY = process.env.AI_READING_API_KEY;
const MODEL = process.env.AI_READING_MODEL;

/** 追问只带最近这么多轮，否则 prompt 会随对话无上限增长。 */
export const MAX_FOLLOW_UP_TURNS = 6;

/** 单个追问的字数上限。 */
export const MAX_QUESTION_LEN = 200;

/**
 * 八字的七个解读方向。`needs` 声明该方向要喂哪些排盘信息，键对应下面的 SECTIONS。
 * 改动 key 或 label 时记得同步 components/BaziChart.jsx 里的按钮列表。
 */
const BAZI_TOPICS = {
  chart: {
    label: "命盘解读",
    prompt:
      "这个人天生的性格底子和能量状态是偏旺还是偏弱、什么样的环境和五行元素对他更有利、整体命局呈现出的特点",
    needs: ["pillars"],
  },
  marriage: {
    label: "婚姻",
    prompt: "婚姻感情运势，包括适配的伴侣特质、相处课题与需要留意的时期",
    needs: ["pillars", "daYun"],
  },
  career: {
    label: "事业",
    prompt: "事业发展方向，适合的行业与角色、优势与容易遇到的瓶颈",
    needs: ["pillars", "daYun"],
  },
  wealth: {
    label: "财运",
    prompt: "财运状况，正财与偏财的倾向、适合的理财方式与破财风险",
    needs: ["pillars", "daYun"],
  },
  health: {
    label: "健康",
    prompt: "健康需要留意的方面，体质倾向与需要保养的脏腑或部位",
    needs: ["pillars"],
  },
  daYun: {
    label: "大运",
    prompt: "当前及未来几步大运的整体走势与阶段性特点",
    needs: ["daYun"],
  },
  liuNian: {
    label: "流年",
    prompt: "近一两年流年运势的整体基调与需要注意的事项",
    needs: ["daYun", "liuNian"],
  },
};

/** 各段排盘信息怎么写成文本。basic 和 wuXing 每个方向都给，不在这里按需选。 */
const SECTIONS = {
  pillars: (chart) => {
    const lines = chart.pillars.map((p) => {
      const hide = p.hideGan.map((h) => `${h.gan}${h.wuXing}/${h.shiShen}`).join("、");
      return `- ${p.label}：${p.ganZhi}（天干${p.gan}${p.ganWuXing}，十神${p.shiShen}；地支${p.zhi}${p.zhiWuXing}，藏干 ${hide}；纳音${p.naYin}，星运${p.diShi}，空亡${p.xunKong}）`;
    });
    return `【四柱详情】\n${lines.join("\n")}`;
  },

  daYun: (chart) => {
    const lines = chart.daYun.map(
      (d) =>
        `- ${d.startAge}—${d.endAge}岁（${d.startYear}—${d.endYear}年）：${d.ganZhi}，十神${d.shiShen}${d.current ? "  ← 当前所在大运" : ""}`,
    );
    return `【起运与大运】\n起运：出生后 ${chart.qiYun.after}（${chart.qiYun.solar} 交运）\n${lines.join("\n")}`;
  },

  liuNian: (chart) => {
    if (!chart.liuNian?.length) return "";
    const lines = chart.liuNian.map(
      (l) => `- ${l.year}年（${l.age}岁）：${l.ganZhi}，十神${l.shiShen}${l.current ? "  ← 今年" : ""}`,
    );
    return `【近年流年】\n${lines.join("\n")}`;
  },
};

/** 每个方向都要的底子：命主基本信息 + 五行力量。 */
function baseSections(chart) {
  const wx = chart.wuXing;
  const basic = [
    `【命主】`,
    `八字：${chart.eightChar}`,
    `日主：${chart.dayMaster.gan}${chart.dayMaster.wuXing}`,
    `性别：${chart.gender}`,
    `生肖：${chart.shengXiao}`,
    `出生：公历 ${chart.solar}，农历 ${chart.lunar}`,
    `当前：${chart.now.year} 年，${chart.now.age} 岁`,
  ].join("\n");

  if (!wx) return [basic];

  const dist = wx.items.map((i) => `${i.name} ${i.score}（${i.percent}%）`).join("，");
  const wuXingText = [
    `【五行力量】（天干计 1 分，地支按藏干本气/中气/余气递减计分，月柱当令加权）`,
    `分布：${dist}`,
    wx.missing.length ? `缺：${wx.missing.join("、")}` : `五行不缺`,
    `同类（比劫+印，即${wx.support.names.join("、")}）占 ${wx.support.percent}% → 身${wx.strength}`,
  ].join("\n");

  return [basic, wuXingText];
}

/** 按解读方向裁剪出要喂给模型的排盘文本。 */
function buildBaziContext(topic, chart) {
  return [...baseSections(chart), ...topic.needs.map((key) => SECTIONS[key]?.(chart) ?? "")]
    .filter(Boolean)
    .join("\n\n");
}

const BAZI_PROFILE = {
  persona: "专业命理师",
  chartLabel: "四柱八字排盘结果",
  topics: BAZI_TOPICS,
  terms: "可以使用命理术语（如身强身弱、用神、格局、十神等）",
  noMakeUp: "比如没给流年就不要谈具体年份",
  hasChart: (chart) => Boolean(chart?.pillars),
  buildContext: buildBaziContext,
};

/** 支持 AI 解读的模块。键是 moduleId，与 lib/modules.js 的 id 对应。 */
export const PROFILES = {
  bazi: BAZI_PROFILE,
  astro: ASTRO_PROFILE,
  synastry: SYNASTRY_PROFILE,
};

/** 发一次对话请求。stream 为真时上游按 SSE 回增量。 */
function postChat(messages, stream) {
  return fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages, stream }),
  });
}

/** 一次性取回裸文本；格式约定和解析归调用方。 */
async function callModel(messages) {
  const res = await postChat(messages, false);

  if (!res.ok) {
    return { error: `AI 服务请求失败（HTTP ${res.status}）` };
  }

  const data = await res.json().catch(() => null);
  const raw = data?.choices?.[0]?.message?.content?.trim();
  if (!raw) {
    return { error: "AI 没有返回有效内容" };
  }

  return { raw };
}

/** 把上游 SSE 响应体拆成增量文本。data 行可能被切在 chunk 中间，所以要留 buffer。 */
async function* sseDeltas(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) return;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      for (const line of event.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return;

        let delta;
        try {
          delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
        } catch {
          continue; // 心跳或非 JSON 行，跳过
        }
        if (delta) yield delta;
      }
    }
  }
}


/**
 * @param {string} moduleId PROFILES 的键
 * @param {string} topicKey 该模块 topics 的键
 * @param {object} chart 该模块排盘函数返回的 chart 对象
 * @returns {Promise<{insight: object} | {error: string}>}
 */
export async function generateInsight(moduleId, topicKey, chart) {
  const profile = PROFILES[moduleId];
  const topic = profile?.topics[topicKey];
  if (!topic) return { error: "未知的解读方向" };
  if (!BASE_URL || !API_KEY || !MODEL) {
    return { error: "AI 解读服务未配置" };
  }

  const context = profile.buildContext(topic, chart);

  const prompt = `你是一位${profile.persona}，面对的是不懂这套术语的普通人。以下是一份${profile.chartLabel}：

${context}

请针对「${topic.label}」方面给出解读，重点关注：${topic.prompt}。

严格按以下纯文本格式输出，不要输出任何格式之外的文字，不要用 JSON、不要用 Markdown：
总括: 一句话总括（30字以内）
---
标题: 小标题（4字以内，如：格局特点）
内容: 该部分内容，60-120字
---
标题: ...
内容: ...
---
标题: ...
内容: ...
要求：
- 恰好 3 组「标题 / 内容」，每组聚焦一个子角度，用 --- 分隔
- 每个字段写在一行内，不要换行
- 只依据上面给出的排盘数据推演，不要臆造没给的信息（${profile.noMakeUp}）
- 保持专业、准确的分析，${profile.terms}，但每次出现术语时紧跟一句简单直白的解释，让不懂的人也能看懂它的意思，不要举生活化的例子或打比喻
- 直接说结论和建议，不要绕弯子，不要免责声明或客套话`;

  const { raw, error } = await callModel([{ role: "user", content: prompt }]);
  if (error) return { error };

  const parsed = parseInsight(raw);
  if (!parsed) {
    return { error: "AI 返回内容解析失败" };
  }

  return { insight: parsed };
}

/**
 * 就某个解读方向追问，流式返回。
 *
 * 和 generateInsight 共用排盘上下文，但不约定输出结构 ——
 * 追问通常是一个很具体的小问题，硬套「总括 + 三段」会注水，也多一处解析失败风险；
 * 没有结构要求，才能边生成边往下发。
 *
 * 上游首个响应头拿到手才返回 stream，让 HTTP 错误还能以状态码形式传出去。
 *
 * @param {{moduleId: string, topicKey: string, chart: object,
 *          insight: {summary: string, sections: {title: string, content: string}[]},
 *          history?: {question: string, answer: string}[], question: string}} args
 * @returns {Promise<{stream: AsyncIterable<string>} | {error: string}>}
 */
export async function streamFollowUp({
  moduleId,
  topicKey,
  chart,
  insight,
  history = [],
  question,
}) {
  const profile = PROFILES[moduleId];
  const topic = profile?.topics[topicKey];
  if (!topic) return { error: "未知的解读方向" };
  if (!BASE_URL || !API_KEY || !MODEL) {
    return { error: "AI 解读服务未配置" };
  }

  const priorInsight = [
    `总括：${insight.summary}`,
    ...insight.sections.map((s) => `${s.title}：${s.content}`),
  ].join("\n");

  const opening = `你是一位${profile.persona}，面对的是不懂这套术语的普通人。以下是一份${profile.chartLabel}：

${profile.buildContext(topic, chart)}

你刚刚就「${topic.label}」给出了如下解读：

${priorInsight}

接下来这个人会就这份解读继续追问。回答要求：
- 只依据上面给出的排盘数据推演，不要臆造没给的信息（${profile.noMakeUp}）
- 100-200 字，一段话说完，不要分小标题、不要用 Markdown、不要免责声明或客套话
- ${profile.terms}，但每次出现时紧跟一句简单直白的解释
- 直接回答被问的那一点，不要把原来的解读重复一遍
- 如果问题超出排盘能回答的范围（比如问彩票号码、问别人的盘、问医疗诊断），直接说明这不是排盘能回答的，不要硬编

明白了就等待提问。`;

  const messages = [
    { role: "user", content: opening },
    { role: "assistant", content: "明白，请提问。" },
    ...history.flatMap((turn) => [
      { role: "user", content: turn.question },
      { role: "assistant", content: turn.answer },
    ]),
    { role: "user", content: question },
  ];

  const res = await postChat(messages, true);
  if (!res.ok || !res.body) {
    return { error: `AI 服务请求失败（HTTP ${res.status}）` };
  }

  return { stream: sseDeltas(res.body) };
}

/**
 * 解析模型输出的分隔文本。
 *
 * 之前用 JSON，模型爱在中文内容里写半角双引号（如 呈"身偏弱"），
 * 没转义就让 JSON.parse 失败。改成逐行取字段后，引号不再有特殊含义。
 */
function parseInsight(raw) {
  // 提示词里写了不要 Markdown，但模型偶尔还是会给字段名加粗、给分隔线用全角破折号，
  // 这两种偏移不改变语义，宽松吃掉即可。
  const field = (block, name) =>
    block
      .match(new RegExp(`^[\\s*#>-]*${name}[\\s*]*[:：]\\s*(.+)$`, "m"))?.[1]
      .replace(/\*+$/, "")
      .trim() ?? "";

  const blocks = raw.split(/^\s*[-—–=*]{3,}\s*$/m);

  // 字段名本身也会漂：见过模型把「总括」写成日文汉字「総括」。
  // 第一段按格式就只有总括这一行，所以匹配不到标签时退回取首行、剥掉「xx:」前缀。
  const head = blocks[0] ?? "";
  const summary =
    field(head, "总括") ||
    head
      .split("\n")
      .map((l) => l.replace(/^[\s*#>-]*[^\s:：]{1,6}[\s*]*[:：]\s*/, "").trim())
      .find(Boolean) ||
    "";

  const sections = blocks
    .slice(1)
    .map((b) => ({ title: field(b, "标题"), content: field(b, "内容") }))
    .filter((s) => s.title && s.content);

  if (!summary || !sections.length) return null;
  return { summary, sections };
}
