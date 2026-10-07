// 排盘结果：四柱 + AI 解读。纯展示，数据结构见 lib/bazi.js 的 castBaziChart。

"use client";

import InsightPanel from "@/components/InsightPanel";
import { accentText } from "@/lib/modules";

const PILLAR_ROWS = [
  { key: "naYin", label: "纳音" },
  { key: "diShi", label: "星运" },
  { key: "xunKong", label: "空亡" },
];

/** key 要和 lib/aiReading.js 里八字的解读方向对齐。 */
const INSIGHT_TOPICS = [
  { key: "chart", label: "命盘解读", glyph: "☯" },
  { key: "marriage", label: "婚姻", glyph: "♥" },
  { key: "career", label: "事业", glyph: "◆" },
  { key: "wealth", label: "财运", glyph: "¥" },
  { key: "health", label: "健康", glyph: "✚" },
  { key: "daYun", label: "大运", glyph: "↝" },
  { key: "liuNian", label: "流年", glyph: "◷" },
];

/** 实际色值在 app/globals.css，浅色主题下换成压深版本。 */
const WUXING_COLOR = {
  木: "var(--wx-wood)",
  火: "var(--wx-fire)",
  土: "var(--wx-earth)",
  金: "var(--wx-metal)",
  水: "var(--wx-water)",
};

export default function BaziChart({ chart, accent }) {
  const { pillars } = chart;
  const accentFg = accentText(accent);
  const topShiShen = chart.shiShen?.items.reduce((a, b) => (b.score > a.score ? b : a));
  const cell = "px-2 py-2 text-center text-sm text-fg/80";
  const rowLabel = "px-2 py-2 text-left text-xs whitespace-nowrap text-fg/35";

  return (
    <div className="mt-5 space-y-5">
      {/* 四柱 */}
      <div className="overflow-x-auto rounded-xl border border-fg/10 bg-fg/[.03] p-4">
        <table className="w-full border-collapse">
          <caption className="mb-3 text-left text-xs text-fg/30">四柱</caption>
          <thead>
            <tr className="border-b border-fg/10">
              <th scope="col" className="w-14" />
              {pillars.map((p) => (
                <th
                  key={p.label}
                  scope="col"
                  className="px-2 pb-2 text-center text-xs font-normal text-fg/40"
                >
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-fg/[.06]">
            <tr>
              <th scope="row" className={rowLabel}>
                十神
              </th>
              {pillars.map((p) => (
                <td key={p.label} className={cell}>
                  {p.shiShen}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className={rowLabel}>
                天干
              </th>
              {pillars.map((p) => (
                <td key={p.label} className="px-2 py-2.5 text-center">
                  <span
                    className="font-display text-xl"
                    style={{ color: WUXING_COLOR[p.ganWuXing] ?? accentFg }}
                  >
                    {p.gan}
                  </span>
                  <span className="ml-1 text-xs text-fg/35">{p.ganWuXing}</span>
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className={rowLabel}>
                地支
              </th>
              {pillars.map((p) => (
                <td key={p.label} className="px-2 py-2.5 text-center">
                  <span
                    className="font-display text-xl"
                    style={{ color: WUXING_COLOR[p.zhiWuXing] ?? "var(--color-fg)" }}
                  >
                    {p.zhi}
                  </span>
                  <span className="ml-1 text-xs text-fg/35">{p.zhiWuXing}</span>
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className={rowLabel}>
                藏干
              </th>
              {pillars.map((p) => (
                <td key={p.label} className="px-2 py-2 text-center text-sm text-fg/80">
                  <div className="space-y-1">
                    {p.hideGan.map((hg, i) => (
                      <div key={hg.gan + i} className="flex items-center justify-center gap-1">
                        <span style={{ color: WUXING_COLOR[hg.wuXing] }}>{hg.gan}</span>
                        <span className="text-xs text-fg/45">{hg.shiShen}</span>
                      </div>
                    ))}
                  </div>
                </td>
              ))}
            </tr>
            {PILLAR_ROWS.map((row) => (
              <tr key={row.key}>
                <th scope="row" className={rowLabel}>
                  {row.label}
                </th>
                {pillars.map((p) => (
                  <td key={p.label} className={cell}>
                    {Array.isArray(p[row.key]) ? p[row.key].join(" ") : p[row.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 五行力量 / 十神占比：同一套计分口径的两个视角，左右对照 */}
      <div className="grid gap-5 md:grid-cols-2">
        {chart.wuXing && (
          <div className="rounded-xl border border-fg/10 bg-fg/[.03] p-4">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <p className="text-xs text-fg/30">五行力量</p>
              <p className="text-xs text-fg/45">
                同类（{chart.wuXing.support.names.join("、")}）
                {chart.wuXing.support.percent}% ·{" "}
                <span style={{ color: accentFg }}>身{chart.wuXing.strength}</span>
              </p>
            </div>
            <div className="space-y-2">
              {chart.wuXing.items.map((item) => (
                <div key={item.name} className="flex items-center gap-3">
                  <span
                    className="w-4 shrink-0 text-center text-sm"
                    style={{ color: WUXING_COLOR[item.name] }}
                  >
                    {item.name}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/[.06]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${item.percent}%`,
                        background: WUXING_COLOR[item.name],
                      }}
                    />
                  </div>
                  <span className="w-20 shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-fg/40">
                    {item.score} · {item.percent}%
                  </span>
                </div>
              ))}
            </div>
            {chart.wuXing.missing.length > 0 && (
              <p className="mt-3 text-xs text-fg/35">
                缺 {chart.wuXing.missing.join("、")}
              </p>
            )}
          </div>
        )}

        {chart.shiShen && (
          <div className="flex flex-col rounded-xl border border-fg/10 bg-fg/[.03] p-4">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <p className="text-xs text-fg/30">十神占比</p>
              {topShiShen && (
                <p className="text-xs text-fg/45">
                  最旺 <span style={{ color: accentFg }}>{topShiShen.name}</span>{" "}
                  {topShiShen.percent}%
                </p>
              )}
            </div>
            {/* 柱高按最旺的那根归一化，否则最高只占 25% 的高度，起伏看不出来。
                flex-1 让图表撑满卡片，卡片高度由左边五行那张决定，两张始终齐平。 */}
            <div className="flex min-h-[110px] flex-1 items-stretch gap-1">
              {chart.shiShen.items.map((item) => (
                <div key={item.name} className="flex min-w-0 flex-1 flex-col items-center">
                  <span className="text-[10px] tabular-nums text-fg/40">
                    {item.percent ? `${item.percent}%` : ""}
                  </span>
                  <div className="flex w-full flex-1 justify-center pt-1">
                    <div className="flex w-2.5 items-end rounded-full bg-fg/[.06]">
                      <div
                        className="w-full rounded-full"
                        style={{
                          height: `${topShiShen.percent ? (item.percent / topShiShen.percent) * 100 : 0}%`,
                          background: WUXING_COLOR[item.wuXing],
                        }}
                      />
                    </div>
                  </div>
                  <span
                    className="mt-1.5 text-[10px] leading-none"
                    style={{ color: WUXING_COLOR[item.wuXing], opacity: item.score ? 1 : 0.35 }}
                  >
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs leading-relaxed text-fg/25">
        按输入时间排盘，年柱以立春换岁、月柱以节气换月。出生地暂只作记录，未做真太阳时校正。
        五行力量按天干计 1 分、地支藏干递减计分、月柱当令加权得出，用于粗判身强身弱，
        不等于专业命理的旺衰判定。十神占比用同一套计分口径，日主本身不算十神、不计分。
      </p>

      <InsightPanel
        moduleId="bazi"
        topics={INSIGHT_TOPICS}
        chart={chart}
        accent={accent}
        accentFg={accentFg}
        placeholder="还想问什么？比如：这个身偏弱具体该怎么补？"
      />
    </div>
  );
}
