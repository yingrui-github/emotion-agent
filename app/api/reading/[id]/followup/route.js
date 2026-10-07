// POST /api/reading/[id]/followup —— 就某个已完成的解读方向继续追问。
// 与 insight 路由一样不持久化：chart、原解读、追问历史都由前端带回来。
// 回答按 text/plain 流式往下发，前端边收边渲染。

import { NextResponse } from "next/server";
import {
  streamFollowUp,
  PROFILES,
  MAX_FOLLOW_UP_TURNS,
  MAX_QUESTION_LEN,
} from "@/lib/aiReading";

/** 历史全部来自前端，会原样进 prompt，所以在这里统一收成字符串并截断。 */
function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-MAX_FOLLOW_UP_TURNS)
    .map((turn) => ({
      question: String(turn?.question ?? "").slice(0, MAX_QUESTION_LEN),
      answer: String(turn?.answer ?? "").slice(0, 2000),
    }))
    .filter((turn) => turn.question && turn.answer);
}

export async function POST(request, { params }) {
  const { id } = await params;
  const profile = PROFILES[id];
  if (!profile) {
    return NextResponse.json({ error: "该模块暂不支持 AI 解读" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { topic, chart, insight, history, question } = body ?? {};

  if (!profile.topics[topic]) {
    return NextResponse.json({ error: "未知的解读方向" }, { status: 400 });
  }
  if (!profile.hasChart(chart)) {
    return NextResponse.json({ error: "缺少排盘数据" }, { status: 400 });
  }
  if (!insight?.summary || !insight.sections?.length) {
    return NextResponse.json({ error: "请先做一次解读，再追问" }, { status: 400 });
  }

  const q = String(question ?? "").trim();
  if (!q) {
    return NextResponse.json({ error: "想问什么？" }, { status: 400 });
  }
  if (q.length > MAX_QUESTION_LEN) {
    return NextResponse.json(
      { error: `追问请控制在 ${MAX_QUESTION_LEN} 字以内，精简一下？` },
      { status: 400 },
    );
  }

  const { stream, error } = await streamFollowUp({
    moduleId: id,
    topicKey: topic,
    chart,
    insight,
    history: sanitizeHistory(history),
    question: q,
  });
  if (error) {
    return NextResponse.json({ error }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const answerStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of stream) {
          controller.enqueue(encoder.encode(delta));
        }
      } catch {
        // 头已经发出去了，改不了状态码，只能提前收尾：
        // 前端拿到的就是一段截断的回答，比整条丢掉好。
      }
      controller.close();
    },
  });

  return new Response(answerStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
