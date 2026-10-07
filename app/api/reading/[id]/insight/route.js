// POST /api/reading/[id]/insight —— 针对已排好的盘，做某个方向的 AI 解读。
// 支持 PROFILES 里登记的模块（八字、星盘、合盘）；chart 由前端传回（服务端不持久化排盘结果）。

import { NextResponse } from "next/server";
import { generateInsight, PROFILES } from "@/lib/aiReading";

export async function POST(request, { params }) {
  const { id } = await params;
  const profile = PROFILES[id];
  if (!profile) {
    return NextResponse.json({ error: "该模块暂不支持 AI 解读" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { topic, chart } = body ?? {};

  if (!profile.topics[topic]) {
    return NextResponse.json({ error: "未知的解读方向" }, { status: 400 });
  }
  if (!profile.hasChart(chart)) {
    return NextResponse.json({ error: "缺少排盘数据" }, { status: 400 });
  }

  const { insight, error } = await generateInsight(id, topic, chart);
  if (error) {
    return NextResponse.json({ error }, { status: 502 });
  }

  return NextResponse.json({ topic, insight });
}
