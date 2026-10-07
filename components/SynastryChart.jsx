// 合盘结果：双方三要素 + 跨盘相位矩阵 + 相位构成 + 落宫叠加 + AI 解读。
//
// 一次请求算完，没有像星盘那样的「换日期再取一张盘」—— 所以这里不发任何请求，
// 全部数据来自服务端的 castSynastryChart（lib/synastry.js）。

"use client";

import AspectGrid from "@/components/AspectGrid";
import InsightPanel from "@/components/InsightPanel";
import { accentText } from "@/lib/modules";

/** 实际色值在 app/globals.css，浅色主题下换成压深版本。 */
const ELEMENT_COLOR = {
  火: "var(--el-fire)",
  土: "var(--el-earth)",
  风: "var(--el-air)",
  水: "var(--el-water)",
};

/** key 要和 lib/synastryReading.js 里的解读方向对齐。 */
const INSIGHT_TOPICS = [
  { key: "overall", label: "整体", glyph: "∞" },
  { key: "attraction", label: "吸引", glyph: "♥" },
  { key: "friction", label: "摩擦", glyph: "∠" },
  { key: "longterm", label: "长期", glyph: "◇" },
];

const card = "rounded-xl border border-fg/10 bg-fg/[.03] p-4";
const cardTitle = "text-xs text-fg/30";
const cell = "px-2 py-2 text-center text-sm text-fg/80";

export default function SynastryChart({ chart, accent }) {
  const accentFg = accentText(accent);
  const { a, b, cross, overlay, counts } = chart;

  // 相位格的行列：十行星 + 天顶 + 上升，顺序与本命盘那张格子一致。
  const pointsOf = (one) => [...one.planets, one.angles[1], one.angles[0]];

  return (
    <div className="mt-5 space-y-5">
      {/* 双方三要素：合盘先看两个人各自是什么人，再看两人之间 */}
      <div className="grid gap-5 md:grid-cols-2">
        <BigThree title="你" one={a} accentFg={accentFg} />
        <BigThree title="对方" one={b} accentFg={accentFg} />
      </div>

      {/* 跨盘相位：行是你、列是对方，每格只有一个相位 */}
      <div className={card}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className={cardTitle}>跨盘相位</p>
          <p className="text-xs text-fg/45">
            行是<span style={{ color: accentFg }}>你的</span>星体，列是
            <span style={{ color: accentFg }}>对方的</span> · 共 {cross.length} 组
          </p>
        </div>
        <AspectGrid
          points={pointsOf(a)}
          cols={pointsOf(b)}
          aspects={cross}
          accent={accent}
          accentFg={accentFg}
          rowPrefix="你的"
          colPrefix="对方的"
        />
      </div>

      {/* 相位构成：只有三条，不复用星盘那个 Distribution */}
      <div className={card}>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <p className={cardTitle}>相位构成</p>
          <p className="text-xs text-fg/45">共 {counts.total} 组</p>
        </div>
        <div className="space-y-2">
          {counts.items.map((item) => (
            <div key={item.name} className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-center text-sm text-fg/70">{item.name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/[.06]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${item.percent}%`, background: accent }}
                />
              </div>
              <span className="w-20 shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-fg/40">
                {item.score} · {item.percent}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 落宫叠加：两张表对照，宫位各按自己那一方的本命宫头算 */}
      <div className="grid gap-5 md:grid-cols-2">
        <Overlay title="对方的行星落在你的宫位" rows={overlay.bInA} />
        <Overlay title="你的行星落在对方的宫位" rows={overlay.aInB} />
      </div>

      <p className="text-xs leading-relaxed text-fg/25">
        合盘只看双方本命盘之间的交互：跨盘相位取双方各自的十行星加上升、天顶，两两配对共 144
        组，容许度与本命盘同一口径；落宫叠加按各自的本命宫头计算，不另排组合盘宫位。
        相位构成只是把成相的组数按性质分了三类，用于看这段关系的基调偏向，
        不是契合度评分 —— 和谐多不等于关系好，紧张多也不等于走不下去。
        不含组合盘（composite）、中点盘与月交点，不等于专业合盘判读。
      </p>

      <InsightPanel
        moduleId="synastry"
        topics={INSIGHT_TOPICS}
        chart={chart}
        accent={accent}
        accentFg={accentFg}
        placeholder="还想问什么？比如：对方的土星压在我的月亮上，具体会怎么表现？"
      />
    </div>
  );
}

/** 一侧的日月升三格 + 出生信息。和星盘的三要素卡同一套样式。 */
function BigThree({ title, one, accentFg }) {
  const { bigThree } = one;

  return (
    <div className={card}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className={cardTitle}>
          <span style={{ color: accentFg }}>{title}</span>的三要素
        </p>
        <p className="text-xs text-fg/45">
          {one.city.name} · {one.solar}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "太阳", pos: bigThree.sun, glyph: "☉" },
          { label: "月亮", pos: bigThree.moon, glyph: "☽" },
          { label: "上升", pos: bigThree.asc, glyph: "ASC" },
        ].map((it) => (
          <div
            key={it.label}
            className="rounded-lg border border-fg/[.08] bg-fg/[.02] p-3 text-center"
          >
            <p className="text-xs text-fg/35">
              <span className="mr-1" aria-hidden="true">
                {it.glyph}
              </span>
              {it.label}
            </p>
            <p
              className="mt-1.5 font-display text-lg"
              style={{ color: ELEMENT_COLOR[it.pos.element] }}
            >
              {it.pos.sign}
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-fg/45">{it.pos.degree}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 一个方向的落宫叠加表。只列十行星 —— 四轴落宫没有意义。 */
function Overlay({ title, rows }) {
  return (
    <div className={card}>
      <p className={`${cardTitle} mb-3`}>{title}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-fg/10">
              {["星体", "星座度数", "宫位"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-2 pb-2 text-center text-xs font-normal text-fg/40"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-fg/[.06]">
            {rows.map((p) => (
              <tr key={p.key}>
                <th
                  scope="row"
                  className="px-2 py-2 text-left text-sm whitespace-nowrap text-fg/70"
                >
                  <span className="mr-1.5 text-fg/40" aria-hidden="true">
                    {p.glyph}
                  </span>
                  {p.name}
                </th>
                <td
                  className="px-2 py-2 text-center text-sm whitespace-nowrap"
                  style={{ color: ELEMENT_COLOR[p.element] }}
                >
                  {p.sign} <span className="tabular-nums text-fg/55">{p.degree}</span>
                </td>
                <td className={cell}>{p.house}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
