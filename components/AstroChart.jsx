// 星盘结果：三要素 + 本命/行运/次限/三限 四种盘 × 星盘/行星/相位 三种读法 + 分布 + AI 解读。
//
// 本命盘由服务端随表单一次算好（lib/astro.js 的 castAstroChart）；
// 行运与推运盘要跟着日期变，改日期时现请求 /api/reading/astro/transit，按「盘别|日期」缓存。

"use client";

import { useEffect, useRef, useState } from "react";

import AspectGrid from "@/components/AspectGrid";
import ChartWheel from "@/components/ChartWheel";
import InsightPanel from "@/components/InsightPanel";
import { accentText } from "@/lib/modules";

/** 实际色值在 app/globals.css，浅色主题下换成压深版本。 */
const ELEMENT_COLOR = {
  火: "var(--el-fire)",
  土: "var(--el-earth)",
  风: "var(--el-air)",
  水: "var(--el-water)",
};

const MOTION_HINT = { 逆: "逆行", 留: "留" };

/** 外层：看哪张盘。key 要和 lib/astro.js 的 TRANSIT_MODES 对齐（natal 除外）。 */
const VIEWS = [
  { key: "natal", label: "本命星盘" },
  { key: "transit", label: "行运" },
  { key: "secondary", label: "次限" },
  { key: "tertiary", label: "三限" },
];

/** 内层：同一张盘的三种读法。 */
const TABS = [
  { key: "wheel", label: "星盘" },
  { key: "table", label: "行星" },
  { key: "aspect", label: "相位" },
];

/** key 要和 lib/astroReading.js 里的解读方向对齐。 */
const INSIGHT_TOPICS = [
  { key: "chart", label: "星盘", glyph: "✶" },
  { key: "aspect", label: "相位", glyph: "∠" },
  { key: "career", label: "事业", glyph: "◆" },
  { key: "marriage", label: "婚姻", glyph: "♥" },
  { key: "wealth", label: "财富", glyph: "¥" },
  { key: "health", label: "健康", glyph: "✚" },
];

/** 日期控件要的本地日期，不能用 toISOString（那是 UTC，中国的凌晨会退到前一天）。 */
function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function AstroChart({ chart, inputs, accent }) {
  const accentFg = accentText(accent);
  const { bigThree, planets, houses, elements, modalities, aspects, angles } = chart;
  const [view, setView] = useState("natal");
  const [tab, setTab] = useState("wheel");
  const [date, setDate] = useState(todayISO);
  // 「盘别|日期」→ {chart} | {error}。切走再切回不重算。
  const [results, setResults] = useState({});
  const requested = useRef(new Set());

  const key = view === "natal" ? null : `${view}|${date}`;
  const entry = key ? results[key] : null;
  const moving = entry?.chart;

  useEffect(() => {
    if (!key || requested.current.has(key)) return;
    requested.current.add(key);

    const save = (value) => setResults((prev) => ({ ...prev, [key]: value }));
    // 失败的键从 requested 里撤掉，重试按钮清掉结果就能再发一次。
    const fail = (message) => {
      requested.current.delete(key);
      save({ error: message });
    };

    fetch("/api/reading/astro/transit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputs, mode: view, date }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          fail(data?.error ?? `请求失败了（HTTP ${res.status}），再试一次？`);
          return;
        }
        save({ chart: data.chart });
      })
      .catch((err) => {
        fail("排盘请求失败了，再试一次？");
        console.error(err);
      });
  }, [key, view, date, inputs]);

  const viewLabel = VIEWS.find((v) => v.key === view).label;

  // 相位格的行列：十行星 + 天顶 + 上升，顺序与 lib/astro.js 的配对范围一致。
  const points = [...planets, angles[1], angles[0]];

  // 行运/推运盘只换行星，宫位、四轴、上升一律沿用本命 —— 要看的是行运行星落进本命第几宫。
  const wheelChart = moving ? { ...chart, planets: moving.planets } : chart;
  // 本命盘里上升和十行星一样占 1 分分布，所以也得列进表里，否则分母 11 没有出处。
  const tableRows =
    view === "natal" ? [...planets, { ...angles[0], house: 1, motion: "" }] : moving?.planets;

  const meta =
    view === "natal"
      ? {
          wheel: (
            <>
              上升在左，宫位逆时针 · <span style={{ color: accentFg }}>{houses.system}</span>
            </>
          ),
          table: "度数为宫内度数 · 含上升，共 11 项参与分布计分",
          aspect: `共 ${aspects.length} 组，交点落字即成相`,
        }
      : {
          wheel: `${viewLabel}行星走在本命宫位上`,
          table: "宫位为本命宫位 · 度数为宫内度数",
          aspect: `${viewLabel}盘自己的十行星互相 · 共 ${moving?.aspects.length ?? 0} 组`,
        };

  const cell = "px-2 py-2 text-center text-sm text-fg/80";
  const card = "rounded-xl border border-fg/10 bg-fg/[.03] p-4";
  const cardTitle = "text-xs text-fg/30";
  const field = `rounded-lg border border-fg/12 bg-fg/[.04] px-2 py-1 text-xs text-fg/80
                 focus:border-fg/35 focus:outline-none`;

  return (
    <div className="mt-5 space-y-5">
      {/* 三要素：对位八字的八字一行，是整张盘最先要看的三格 */}
      <div className={card}>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <p className={cardTitle}>三要素</p>
          <p className="text-xs text-fg/45">
            {chart.city.name} · {chart.solar} {chart.timezone}
            {chart.timeShifted && " · 已顺延 1 小时"}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "太阳", pos: bigThree.sun, glyph: "☉" },
            { label: "月亮", pos: bigThree.moon, glyph: "☽" },
            { label: "上升", pos: bigThree.asc, glyph: "ASC" },
          ].map((it) => (
            <div key={it.label} className="rounded-lg border border-fg/[.08] bg-fg/[.02] p-3 text-center">
              <p className="text-xs text-fg/35">
                <span className="mr-1" aria-hidden="true">{it.glyph}</span>
                {it.label}
              </p>
              <p className="mt-1.5 font-display text-lg" style={{ color: ELEMENT_COLOR[it.pos.element] }}>
                {it.pos.sign}
              </p>
              <p className="mt-0.5 text-xs tabular-nums text-fg/45">{it.pos.degree}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 四张盘 × 三种读法都挤在一个卡片里：外层 tab 选盘，内层 tab 选读法 */}
      <div className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div
            role="tablist"
            aria-label="盘别"
            className="flex items-center gap-0.5 rounded-lg border border-fg/10 bg-fg/[.02] p-0.5"
          >
            {VIEWS.map((v) => {
              const on = v.key === view;
              return (
                <button
                  key={v.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setView(v.key)}
                  className={`rounded-md px-3 py-1.5 text-xs transition ${
                    on ? "" : "text-fg/40 hover:text-fg/70"
                  }`}
                  style={on ? { background: `${accent}24`, color: accentFg } : undefined}
                >
                  {v.label}
                </button>
              );
            })}
          </div>

          {/* 行运与推运盘跟着日期走，本命盘没有这个控件 */}
          {view !== "natal" && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={date}
                min="1900-01-01"
                max="2100-12-31"
                onChange={(e) => setDate(e.target.value)}
                aria-label={`${viewLabel}盘的日期`}
                className={`${field} tabular-nums [color-scheme:light_dark]`}
              />
              <button
                type="button"
                onClick={() => setDate(todayISO())}
                disabled={date === todayISO()}
                className={`${field} shrink-0 transition hover:text-fg/100 disabled:opacity-40`}
              >
                今天
              </button>
            </div>
          )}
        </div>

        {/* 推运口径与实际取天象的瞬间：次限 / 三限的盘面离目标日期很远，不写出来没人看得懂 */}
        {moving && (
          <p className="mb-3 text-xs text-fg/35">
            {moving.note} · 天象取 <span className="tabular-nums">{moving.moment}</span>
          </p>
        )}

        <div className="mb-2 flex items-baseline justify-between gap-3">
          <div role="tablist" aria-label="星盘视图" className="flex items-center gap-1">
            {TABS.map((t) => {
              const on = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(t.key)}
                  className={`rounded-md px-2.5 py-1 text-xs transition ${
                    on ? "" : "text-fg/35 hover:text-fg/60"
                  }`}
                  style={on ? { background: `${accent}1a`, color: accentFg } : undefined}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-fg/45">{meta[tab]}</p>
        </div>

        {view !== "natal" && !moving ? (
          entry?.error ? (
            <div className="rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-sm text-rose-200/80">
              {entry.error}
              <button
                type="button"
                onClick={() =>
                  setResults((prev) => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                  })
                }
                className="ml-2 underline underline-offset-2 hover:text-rose-200"
              >
                重试
              </button>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-fg/45">正在排{viewLabel}盘…</p>
          )
        ) : (
          <>
            {tab === "wheel" && (
              <ChartWheel
                chart={wheelChart}
                title={view === "natal" ? "本命星盘" : `${viewLabel}盘`}
                accent={accent}
                accentFg={accentFg}
                elementColor={ELEMENT_COLOR}
              />
            )}

            {tab === "table" && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-fg/10">
                      {["星体", "星座", "度数", "宫位", "状态"].map((h) => (
                        <th key={h} scope="col" className="px-2 pb-2 text-center text-xs font-normal text-fg/40">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-fg/[.06]">
                    {tableRows.map((p) => (
                      <tr key={p.key}>
                        <th scope="row" className="px-2 py-2 text-left text-sm whitespace-nowrap text-fg/70">
                          <span className="mr-1.5 text-fg/40" aria-hidden="true">{p.glyph}</span>
                          {p.name}
                        </th>
                        <td className="px-2 py-2 text-center text-sm" style={{ color: ELEMENT_COLOR[p.element] }}>
                          {p.sign}
                        </td>
                        <td className={`${cell} tabular-nums`}>{p.degree}</td>
                        <td className={cell}>{p.house}</td>
                        <td className="px-2 py-2 text-center text-xs text-fg/45">
                          {MOTION_HINT[p.motion] ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "aspect" && (
              <AspectGrid
                points={view === "natal" ? points : moving.planets}
                aspects={view === "natal" ? aspects : moving.aspects}
                accent={accent}
                accentFg={accentFg}
              />
            )}
          </>
        )}
      </div>

      {/* 元素分布 / 三分法分布：同一套计分口径的两个视角，左右对照 */}
      <div className="grid gap-5 md:grid-cols-2">
        <Distribution
          title="元素分布"
          data={elements}
          colorOf={(name) => ELEMENT_COLOR[name]}
          accentFg={accentFg}
        />
        <Distribution
          title="三分法分布"
          data={modalities}
          colorOf={() => accent}
          accentFg={accentFg}
        />
      </div>

      <p className="text-xs leading-relaxed text-fg/25">
        按回归黄道、{houses.system} 宫位制排盘，行星取真春分点下的视黄经，含岁差与章动。
        出生城市取市中心坐标，同城不同区的上升点差异在 0.1° 以内；时区换算依赖系统时区库，
        中国 1986—1991 年的夏令时会自动计入。元素与三分法分布按十行星各 1 分、上升 1 分计，
        只用于看能量偏向，不等于专业星盘判读。月交点、凯龙星与小行星暂未纳入。
        行运与推运盘的日期只到天，一律取当地正午的天象；行星落宫按本命宫位来算，
        不另排行运宫位与行运上升，相位只看该盘自己的十行星。
      </p>

      <InsightPanel
        moduleId="astro"
        topics={INSIGHT_TOPICS}
        chart={chart}
        accent={accent}
        accentFg={accentFg}
        placeholder="还想问什么？比如：上升狮子和月亮双鱼这组反差怎么处理？"
      />
    </div>
  );
}

/** 横条形分布图。样式与八字的五行力量一致，两个模块看起来是一家的。 */
function Distribution({ title, data, colorOf, accentFg }) {
  const top = data.items.reduce((a, b) => (b.score > a.score ? b : a));

  return (
    <div className="rounded-xl border border-fg/10 bg-fg/[.03] p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-xs text-fg/30">{title}</p>
        <p className="text-xs text-fg/45">
          偏 <span style={{ color: accentFg }}>{top.name}</span> {top.percent}% · 共 {data.total} 分
        </p>
      </div>
      <div className="space-y-2">
        {data.items.map((item) => (
          <div key={item.name} className="flex items-center gap-3">
            <span className="w-8 shrink-0 text-center text-sm" style={{ color: colorOf(item.name) }}>
              {item.name}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/[.06]">
              <div
                className="h-full rounded-full"
                style={{ width: `${item.percent}%`, background: colorOf(item.name) }}
              />
            </div>
            <span className="w-20 shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-fg/40">
              {item.score} · {item.percent}%
            </span>
          </div>
        ))}
      </div>
      {data.missing.length > 0 && (
        <p className="mt-3 text-xs text-fg/35">缺 {data.missing.join("、")}</p>
      )}
    </div>
  );
}
