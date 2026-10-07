"use client";

import Link from "next/link";
import { useState } from "react";

import { accentText } from "@/lib/modules";

export default function AgentConsole() {
  const [query, setQuery] = useState("");
  const [routing, setRouting] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    const q = query.trim();
    if (!q || pending) return;

    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRouting(await res.json());
    } catch (err) {
      setError("分派失败了，再试一次？");
      setRouting(null);
      console.error(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {/* 主 Agent 输入框 */}
      <form onSubmit={handleSubmit} className="mt-8 text-left">
        <div
          className="rounded-2xl border border-fg/12 bg-fg/[.04] p-2 backdrop-blur
                     transition focus-within:border-gold/45 focus-within:bg-fg/[.06]
                     focus-within:shadow-[0_0_50px_-12px_rgba(232,192,122,.45)]"
        >
          <label htmlFor="agent-q" className="sr-only">
            描述你此刻的困惑
          </label>
          <textarea
            id="agent-q"
            name="q"
            rows={3}
            required
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例如：我和他总为同一件事吵架，是性格不合还是缘分不够？"
            className="w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-relaxed
                       text-fg/90 placeholder:text-fg/25 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-3 px-3 pb-1">
            <span className="text-xs text-fg/25">Enter 换行 · 点击发送</span>
            <button
              type="submit"
              disabled={pending || !query.trim()}
              className="rounded-full bg-gradient-to-r from-gold to-amber-300 px-6 py-2
                         text-sm font-medium text-ink transition hover:brightness-110
                         active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "分派中…" : "发送"}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-left text-sm text-rose-200/80">
          {error}
        </p>
      )}

      {routing && <RoutingResult routing={routing} />}
    </>
  );
}

/** 主 Agent 的回应 + 分派结果 */
function RoutingResult({ routing }) {
  const { module: m, reply, alternatives } = routing;
  const href = `/m/${m.id}`;

  return (
    <div
      className="mt-6 rounded-2xl border p-5 text-left backdrop-blur"
      style={{
        borderColor: `${m.accent}40`,
        background: `linear-gradient(180deg, ${m.accent}12, transparent)`,
      }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-xl" style={{ color: accentText(m.accent) }} aria-hidden="true">
          {m.glyph}
        </span>
        <div className="flex-1">
          <p className="text-sm leading-relaxed text-fg/80">{reply}</p>
          <Link
            href={href}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium transition hover:gap-2.5"
            style={{ color: accentText(m.accent) }}
          >
            进入 {m.name} <span aria-hidden="true">→</span>
          </Link>

          {alternatives?.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-fg/8 pt-3">
              <span className="text-xs text-fg/30">也可能是</span>
              {alternatives.map((alt) => (
                <Link
                  key={alt.id}
                  href={`/m/${alt.id}`}
                  className="rounded-full border border-fg/12 px-3 py-1 text-xs text-fg/55
                             transition hover:border-fg/30 hover:text-fg/90"
                >
                  <span style={{ color: accentText(alt.accent) }} aria-hidden="true">
                    {alt.glyph}
                  </span>{" "}
                  {alt.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
