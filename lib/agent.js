// 主 Agent 的意图识别。
//
// 当前是**占位实现**：用带权关键词打分，把用户的话路由到最合适的子模块。
// 接入真实模型时，只需替换 route() 内部逻辑，返回结构保持不变即可。

import { getModule } from "./modules";

// 关键词 -> 权重。权重区分信号强弱：
//   3 = 领域专有词（几乎只出现在该模块语境）
//   2 = 较强指向
//   1 = 弱指向，容易和其他模块重叠
const KEYWORDS = {
  bazi: {
    八字: 3, 命盘: 3, 五行: 3, 十神: 3, 大运: 3, 流年: 3,
    生辰: 2, 命理: 2, 生肖: 2, 属相: 2, 时辰: 2,
  },
  astro: {
    星盘: 3, 星座: 3, 宫位: 3, 占星: 3, 本命盘: 3, 上升星座: 3, 太阳星座: 3,
    上升: 2, 月亮: 2, 金星: 2, 水逆: 2, 相位: 2,
  },
  synastry: {
    合盘: 3, 缘分: 3, 姻缘: 3, 正缘: 3, 配对: 3, 注定: 3,
    在一起: 2, 我们俩: 2, 两个人: 2, 暗恋: 2, 伴侣: 2, 分手: 2, 复合: 2,
    合适: 1, 有没有可能: 1,
  },
};

// 同分时的优先级：越靠前越优先。合盘的词最专有，放最前；
// 兜底给 bazi —— 只要用户给了生辰就有东西可算。
const PRIORITY = ["synastry", "astro", "bazi"];
const FALLBACK_ID = "bazi";

function scoreAll(text) {
  const scores = {};
  for (const [id, words] of Object.entries(KEYWORDS)) {
    scores[id] = Object.entries(words).reduce(
      (sum, [kw, weight]) => (text.includes(kw) ? sum + weight : sum),
      0,
    );
  }
  return scores;
}

/**
 * 把一句自然语言分派到某个子模块。
 * @param {string} query
 * @returns {{query: string, module: object, confident: boolean, reply: string, alternatives: object[]}}
 */
export function route(query) {
  const text = (query ?? "").trim();
  const scores = scoreAll(text);

  // 先按分数降序，再按 PRIORITY 打破平局
  const ranked = Object.keys(scores).sort(
    (a, b) => scores[b] - scores[a] || PRIORITY.indexOf(a) - PRIORITY.indexOf(b),
  );

  const confident = scores[ranked[0]] > 0;
  const bestId = confident ? ranked[0] : FALLBACK_ID;
  const module = getModule(bestId);

  const alternatives = confident
    ? ranked.slice(1).filter((id) => scores[id] > 0).slice(0, 2).map(getModule)
    : [];

  const reply = confident
    ? `听起来这件事适合从「${module.name}」切入——${module.desc}`
    : `我还没完全听懂，先从「${module.name}」开始聊聊？也可以直接点下面的模块。`;

  return { query: text, module, confident, reply, alternatives };
}
