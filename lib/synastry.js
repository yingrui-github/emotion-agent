// 关系合盘：两个人各排一张本命星盘，再看两张盘之间的交互。
//
// 两件事：
//   1. 跨盘相位 —— A 的十二个点配 B 的十二个点，跑满 12×12 的矩形。
//      和本命盘那张阶梯矩阵不同，这里每格只有一个相位，不丢也不二读。
//   2. 落宫叠加 —— 对方的行星落进我的第几宫（以及反过来），用各自的本命宫头算。
//
// 不做组合盘（composite）、不做中点盘，也不编「契合度」分数 ——
// 只给相位构成的计数，怎么读交给解读那一层。

import { castAstroChart, castCrossAspects, houseOf } from "./astro.js";

/** 表单字段前缀 → 这一侧的人话称呼。错误提示要带上它，否则不知道哪边填错了。 */
const SIDES = [
  { prefix: "a", label: "你的生辰" },
  { prefix: "b", label: "对方的生辰" },
];

/** 合盘表单的字段名是 aBirthYear / bBirthYear…，拆回 castAstroChart 认的那套。 */
const FIELDS = ["birthYear", "birthMonth", "birthDay", "birthTime", "birthPlace"];

function sideForm(form, prefix) {
  return Object.fromEntries(
    FIELDS.map((f) => [f, form?.[`${prefix}${f[0].toUpperCase()}${f.slice(1)}`]]),
  );
}

/** 参与相位的点：十行星 + 上升 + 天顶，与本命盘的相位口径一致。 */
const pointsOf = (chart) => [...chart.planets, chart.angles[0], chart.angles[1]];

/** 对方的十行星落进这张盘的第几宫。四轴不参与 —— 轴点落宫没有意义。 */
function overlay(planets, cusps) {
  return planets.map((p) => ({
    key: p.key,
    name: p.name,
    short: p.short,
    glyph: p.glyph,
    sign: p.sign,
    degree: p.degree,
    element: p.element,
    house: houseOf(p.lon, cusps),
  }));
}

/**
 * 相位构成：六分与三分算和谐，刑与冲算紧张，合单列 ——
 * 合本身不分好坏，看的是哪两颗星合，塞进任何一边都是误导。
 */
function tally(cross) {
  const by = (types) => cross.filter((x) => types.includes(x.type)).length;
  const items = [
    { name: "和谐", score: by(["六分", "三分"]) },
    { name: "紧张", score: by(["刑", "冲"]) },
    { name: "合", score: by(["合"]) },
  ];
  const total = cross.length;
  return {
    total,
    items: items.map((it) => ({
      ...it,
      percent: total ? Math.round((it.score / total) * 1000) / 10 : 0,
    })),
  };
}

/**
 * 合盘主入口。签名与 castAstroChart / castBaziChart 一致。
 *
 * @param {object} form 两套生辰，字段名为 aBirthYear… / bBirthYear…
 * @returns {{chart: object} | {error: string}}
 */
export function castSynastryChart(form) {
  const charts = [];
  for (const { prefix, label } of SIDES) {
    const { chart, error } = castAstroChart(sideForm(form, prefix));
    if (error) return { error: `${label}：${error}` };
    charts.push(chart);
  }

  const [a, b] = charts;
  const cross = castCrossAspects(pointsOf(a), pointsOf(b));

  return {
    chart: {
      a,
      b,
      cross,
      overlay: {
        // 「对方的行星在我的宫位里」—— 看的人是 A，所以这一项通常先读。
        bInA: overlay(b.planets, a.houses.cusps),
        aInB: overlay(a.planets, b.houses.cusps),
      },
      counts: tally(cross),
    },
  };
}
