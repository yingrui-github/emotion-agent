// AI 专项解读面板：方向按钮 + 结构化解读 + 流式追问。
//
// 八字与星盘共用这一个面板，差异只在 moduleId（决定请求打到哪个模块的路由）
// 和 topics（方向按钮）。解读结果与追问历史都按方向存，切走再切回还在。
//
// 服务端的解读方向在 lib/aiReading.js 与 lib/astroReading.js，topics 的 key 要和那边对齐 ——
// 这份列表不从 lib 导入，否则提示词全文会被打进浏览器包。

"use client";

import { useState } from "react";

export default function InsightPanel({ moduleId, topics, chart, accent, accentFg, placeholder }) {
  const [activeTopic, setActiveTopic] = useState(null);
  const [insights, setInsights] = useState({});
  const [pendingTopic, setPendingTopic] = useState(null);
  const [insightError, setInsightError] = useState("");
  const [followUps, setFollowUps] = useState({});
  const [drafts, setDrafts] = useState({});
  // 正在流式生成的那一轮。答完才并入 followUps，失败就整轮丢掉、把草稿还给用户。
  const [streamingTurn, setStreamingTurn] = useState(null);
  const [askPending, setAskPending] = useState(false);
  const [askError, setAskError] = useState("");

  async function handleTopicClick(topicKey) {
    setActiveTopic(topicKey);
    setInsightError("");
    setAskError("");
    if (insights[topicKey] || pendingTopic) return;

    setPendingTopic(topicKey);
    try {
      const res = await fetch(`/api/reading/${moduleId}/insight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topicKey, chart }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setInsightError(data?.error ?? `请求失败了（HTTP ${res.status}），再试一次？`);
        return;
      }
      setInsights((prev) => ({ ...prev, [topicKey]: data.insight }));
    } catch (err) {
      setInsightError("AI 解读请求失败了，再试一次？");
      console.error(err);
    } finally {
      setPendingTopic(null);
    }
  }
  async function handleAsk(topicKey) {
    const question = (drafts[topicKey] ?? "").trim();
    if (!question || askPending) return;

    setAskPending(true);
    setAskError("");
    setStreamingTurn({ topic: topicKey, question, answer: "" });
    setDrafts((prev) => ({ ...prev, [topicKey]: "" }));

    // 出错时把草稿还回去，用户不用重新打一遍。
    const fail = (message) => {
      setAskError(message);
      setStreamingTurn(null);
      setDrafts((prev) => ({ ...prev, [topicKey]: question }));
    };

    try {
      const res = await fetch(`/api/reading/${moduleId}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topicKey,
          chart,
          insight: insights[topicKey],
          history: followUps[topicKey] ?? [],
          question,
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        fail(data?.error ?? `请求失败了（HTTP ${res.status}），再试一次？`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setStreamingTurn({ topic: topicKey, question, answer });
      }

      answer = answer.trim();
      if (!answer) {
        fail("AI 没有返回内容，再试一次？");
        return;
      }
      setFollowUps((prev) => ({
        ...prev,
        [topicKey]: [...(prev[topicKey] ?? []), { question, answer }],
      }));
      setStreamingTurn(null);
    } catch (err) {
      fail("追问失败了，再试一次？");
      console.error(err);
    } finally {
      setAskPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-fg/10 bg-fg/[.03] p-4">
      <p className="mb-3 text-xs text-fg/30">AI 解读</p>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {topics.map((topic) => {
          const isActive = activeTopic === topic.key;
          const isPending = pendingTopic === topic.key;
          return (
            <button
              key={topic.key}
              type="button"
              onClick={() => handleTopicClick(topic.key)}
              disabled={isPending}
              className="flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50"
              style={
                isActive
                  ? { borderColor: accent, color: accentFg, background: `${accent}18` }
                  : {
                      borderColor: "color-mix(in oklab, var(--color-fg) 12%, transparent)",
                      color: "color-mix(in oklab, var(--color-fg) 60%, transparent)",
                    }
              }
            >
              <span aria-hidden="true">{topic.glyph}</span>
              {isPending ? "解读中…" : topic.label}
            </button>
          );
        })}
      </div>

      {insightError && (
        <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-sm text-rose-200/80">
          {insightError}
        </p>
      )}

      {activeTopic && !insightError && (
        <div className="mt-4 rounded-xl border border-fg/10 bg-fg/[.02] p-5">
          {pendingTopic === activeTopic ? (
            <p className="text-sm text-fg/45">AI 正在解读，请稍候…</p>
          ) : (
            insights[activeTopic] && (
              <div className="space-y-4">
                <p
                  className="text-[15px] font-medium leading-relaxed"
                  style={{ color: accentFg }}
                >
                  {insights[activeTopic].summary}
                </p>
                <div className="space-y-3.5 border-t border-fg/8 pt-4">
                  {insights[activeTopic].sections.map((sec, i) => (
                    <div key={i} className="flex gap-3">
                      <span
                        className="mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-xs font-medium"
                        style={{ background: `${accent}1a`, color: accentFg }}
                      >
                        {sec.title}
                      </span>
                      <p className="flex-1 text-sm leading-relaxed text-fg/75">{sec.content}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 border-t border-fg/8 pt-4">
                  {(followUps[activeTopic] ?? []).map((turn, i) => (
                    <div key={i} className="space-y-3">
                      <div className="flex justify-end">
                        <p
                          className="max-w-[80%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm leading-relaxed text-fg/85"
                          style={{ background: `${accent}1f` }}
                        >
                          {turn.question}
                        </p>
                      </div>
                      <div className="flex justify-start">
                        <p className="max-w-[85%] rounded-2xl rounded-bl-md border border-fg/10 bg-fg/[.04] px-3.5 py-2 text-sm leading-relaxed text-fg/75">
                          {turn.answer}
                        </p>
                      </div>
                    </div>
                  ))}

                  {streamingTurn?.topic === activeTopic && (
                    <div className="space-y-3">
                      <div className="flex justify-end">
                        <p
                          className="max-w-[80%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm leading-relaxed text-fg/85"
                          style={{ background: `${accent}1f` }}
                        >
                          {streamingTurn.question}
                        </p>
                      </div>
                      <div className="flex justify-start">
                        <p
                          aria-live="polite"
                          className="max-w-[85%] rounded-2xl rounded-bl-md border border-fg/10 bg-fg/[.04] px-3.5 py-2 text-sm leading-relaxed text-fg/75"
                        >
                          {streamingTurn.answer || (
                            <span className="text-fg/45">AI 正在想，请稍候…</span>
                          )}
                          {/* 光标跟在末尾，让人看出还在写 */}
                          <span
                            className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse align-middle"
                            style={{ background: accent }}
                          />
                        </p>
                      </div>
                    </div>
                  )}

                  {askError && (
                    <p className="rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-sm text-rose-200/80">
                      {askError}
                    </p>
                  )}

                  <FollowUpInput
                    moduleId={moduleId}
                    accent={accent}
                    pending={askPending}
                    placeholder={placeholder}
                    value={drafts[activeTopic] ?? ""}
                    onChange={(v) => setDrafts((prev) => ({ ...prev, [activeTopic]: v }))}
                    onSubmit={() => handleAsk(activeTopic)}
                  />
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

/** 追问输入框。样式对齐首页 AgentConsole 的输入框，小一号、按钮取模块主色。 */
function FollowUpInput({ moduleId, accent, pending, placeholder, value, onChange, onSubmit }) {
  const id = `${moduleId}-followup`;

  return (
    <div
      className="rounded-xl border border-fg/12 bg-fg/[.04] p-1.5
                 transition focus-within:border-fg/30 focus-within:bg-fg/[.06]"
    >
      <label htmlFor={id} className="sr-only">
        就这段解读继续追问
      </label>
      <textarea
        id={id}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        className="w-full resize-none bg-transparent px-2.5 py-1.5 text-sm leading-relaxed
                   text-fg/90 placeholder:text-fg/25 focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3 px-2 pb-0.5">
        <span className="text-xs text-fg/25">Enter 发送 · Shift+Enter 换行</span>
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending || !value.trim()}
          className="rounded-lg px-4 py-1.5 text-xs font-medium text-ink transition
                     hover:brightness-110 active:scale-[.97]
                     disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: `linear-gradient(90deg, ${accent}, ${accent}cc)` }}
        >
          {pending ? "追问中…" : "追问"}
        </button>
      </div>
    </div>
  );
}
