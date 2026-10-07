// POST /api/agent —— 主 Agent 意图分派。
//
// 接入真实模型时改这里：把 route() 换成模型调用即可，响应结构保持不变。
// API key 之类的密钥放在服务端环境变量里，不要泄到浏览器。

import { NextResponse } from "next/server";
import { route } from "@/lib/agent";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const q = typeof body.q === "string" ? body.q : "";

  if (!q.trim()) {
    return NextResponse.json({ error: "问题不能为空" }, { status: 400 });
  }

  return NextResponse.json(route(q));
}
