"use client";

import Link from "next/link";
import { useState } from "react";

import AstroChart from "@/components/AstroChart";
import BaziChart from "@/components/BaziChart";
import SynastryChart from "@/components/SynastryChart";
import { accentText } from "@/lib/modules";

/** 已接入真实排盘的模块各有自己的结果组件，按 moduleId 分发。 */
const CHARTS = { bazi: BaziChart, astro: AstroChart, synastry: SynastryChart };

/**
 * 按相邻的 group 值把字段切成若干行。合盘有两套同构的生辰，十个框挤在一行读不出
 * 哪五个是谁的，所以带 groupLabel 的组单独成行、行首写出组名。
 */
function toRows(inputs) {
  const rows = [];
  for (const f of inputs) {
    const last = rows[rows.length - 1];
    if (last && last.group === f.group) last.fields.push(f);
    else rows.push({ group: f.group, label: f.groupLabel, fields: [f] });
  }
  return rows;
}

/** 输入途中只拦掉非法字符，不动结构 —— 边打边重排会把光标顶走。 */
function cleanTime(raw) {
  return raw.replace(/[：]/g, ":").replace(/[^\d:]/g, "").slice(0, 5);
}

/** 离开输入框时才补成 hh:mm：9 → 09:00，918 → 09:18，0108 → 01:08，9:3 → 09:03。 */
function formatTime(raw) {
  const text = cleanTime(raw);
  if (!text) return "";

  const [h, mi] = text.includes(":")
    ? text.split(":")
    : text.length <= 2
      ? [text, "0"]
      : [text.slice(0, -2), text.slice(-2)];

  if (!h) return text;
  return `${h.padStart(2, "0")}:${(mi || "0").padStart(2, "0")}`;
}

export default function ModuleView({ module: m }) {
  const Chart = CHARTS[m.id];
  const [fields, setFields] = useState(() =>
    Object.fromEntries(m.inputs.map(({ name }) => [name, ""])),
  );
  const [reading, setReading] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError("");
    try {
      const res = await fetch(`/api/reading/${m.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // 输入校验这类错误后端会带上原因，直接显示给用户。
        setError(data?.error ?? `请求失败了（HTTP ${res.status}），再试一次？`);
        setReading(null);
        return;
      }
      setReading(data);
    } catch (err) {
      setError("解读请求失败了，再试一次？");
      setReading(null);
      console.error(err);
    } finally {
      setPending(false);
    }
  }

  const rows = toRows(m.inputs);

  const submit = (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl px-6 py-2.5 text-sm font-medium text-ink transition
                 hover:brightness-110 active:scale-[.98] disabled:cursor-not-allowed
                 disabled:opacity-50"
      style={{ background: `linear-gradient(90deg, ${m.accent}, ${m.accent}cc)` }}
    >
      {pending ? (m.pendingLabel ?? "推演中…") : (m.submitLabel ?? "开始解读")}
    </button>
  );

  return (
    <>
      {/* 负 margin 抵掉 layout 里 main 的一部分上边距：返回链接是附属于页头的，
          不该和页头隔着整段留白。只在模块页收，首页的留白保持原样。
          用 flex w-fit 而非 inline-flex —— 行内级盒子的负上边距只会撑大行盒，位置不动。 */}
      <Link
        href="/"
        className="-mt-5 flex w-fit items-center gap-1.5 text-sm text-fg/35 transition hover:text-fg/70 sm:-mt-8"
      >
        <span aria-hidden="true">←</span> 返回主 Agent
      </Link>

      {/* 模块名不再单独占一块（页头卡片已去掉），但留给读屏和文档结构 */}
      <h1 className="sr-only">{m.name}</h1>

      <div className="mt-6 space-y-6">
        {/* 上：输入区 */}
        <section className="rounded-2xl border border-fg/10 bg-fg/[.03] p-6 backdrop-blur">
          <h2 className="font-display text-base tracking-wider text-fg/75">
            {m.inputLabel ?? "输入"}
          </h2>
          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            {rows.map((row, i) => (
              <div key={row.group ?? `plain-${i}`} className="flex flex-wrap items-center gap-3">
                {row.label && (
                  <span className="shrink-0 text-sm text-fg/45">{row.label}</span>
                )}
                {row.fields.map((f) => (
                <div key={f.name} className="flex items-center gap-1.5">
                  <label htmlFor={f.name} className="shrink-0 text-sm text-fg/45">
                    {f.label}
                  </label>
                  {f.type === "select" ? (
                    <select
                      id={f.name}
                      name={f.name}
                      value={fields[f.name]}
                      onChange={(e) =>
                        setFields((prev) => ({ ...prev, [f.name]: e.target.value }))
                      }
                      className="w-auto appearance-none rounded-xl border border-fg/12 bg-fg/[.04]
                                 px-3.5 py-2.5 text-sm text-fg/90 focus:border-fg/35
                                 focus:outline-none [&>option]:bg-page [&>option]:text-fg/90"
                    >
                      <option value="">请选择</option>
                      {f.options.map((opt) => {
                        const { value, label } =
                          typeof opt === "string" ? { value: opt, label: opt } : opt;
                        return (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      id={f.name}
                      name={f.name}
                      type={f.type}
                      inputMode={f.inputMode}
                      placeholder={f.hint}
                      value={fields[f.name]}
                      onChange={(e) =>
                        setFields((prev) => ({
                          ...prev,
                          [f.name]:
                            f.format === "time" ? cleanTime(e.target.value) : e.target.value,
                        }))
                      }
                      onBlur={
                        f.format === "time"
                          ? (e) =>
                              setFields((prev) => ({
                                ...prev,
                                [f.name]: formatTime(e.target.value),
                              }))
                          : undefined
                      }
                      className={`rounded-xl border border-fg/12 bg-fg/[.04] py-2.5
                                  text-sm text-fg/90 placeholder:text-fg/25
                                  focus:border-fg/35 focus:outline-none ${
                                    f.group
                                      ? `${f.width ?? "w-16"} px-2 text-center`
                                      : "w-40 px-3.5"
                                  }`}
                    />
                  )}
                </div>
                ))}
                {/* 没有分组的字段那一行顺带放提交按钮；全是分组（合盘）时按钮单独一行 */}
                {i === rows.length - 1 && !row.group && submit}
              </div>
            ))}
            {rows[rows.length - 1].group && <div>{submit}</div>}
          </form>
        </section>

        {/* 下：结果区 */}
        <section className="rounded-2xl border border-fg/10 bg-fg/[.03] p-6 backdrop-blur">
          <h2 className="font-display text-base tracking-wider text-fg/75">
            {m.resultLabel ?? "解读"}
          </h2>

          {error && (
            <p className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-sm text-rose-200/80">
              {error}
            </p>
          )}

          {reading?.chart && Chart ? (
            <Chart chart={reading.chart} inputs={reading.inputs} accent={m.accent} />
          ) : reading ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-fg/10 bg-fg/[.03] p-4">
                <p className="mb-2 text-xs text-fg/30">已接收</p>
                <dl className="space-y-1.5 text-sm">
                  {m.inputs.map((f) => (
                    <div key={f.name} className="flex gap-3">
                      <dt className="w-24 shrink-0 text-fg/40">{f.label}</dt>
                      <dd className="text-fg/80">{reading.inputs[f.name] || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div
                className="rounded-xl border border-dashed p-5 text-sm leading-relaxed text-fg/45"
                style={{ borderColor: `${m.accent}40` }}
              >
                <span style={{ color: accentText(m.accent) }}>占位：</span>
                {reading.placeholder}
              </div>
            </div>
          ) : (
            !error && (
              <div
                className="mt-5 flex min-h-[180px] flex-col items-center justify-center rounded-xl
                           border border-dashed border-fg/12 px-6 text-center"
              >
                <span className="text-4xl opacity-25" style={{ color: accentText(m.accent) }} aria-hidden="true">
                  {m.glyph}
                </span>
                <p className="mt-4 text-sm text-fg/35">
                  填好上方信息，{m.resultLabel ?? "解读"}会出现在这里。
                </p>
              </div>
            )
          )}
        </section>
      </div>
    </>
  );
}
