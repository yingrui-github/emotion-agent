// POST /api/reading/[id]/transit —— 同一份生辰的行运 / 次限 / 三限盘。
//
// 和 insight 路由一样不持久化：前端把排本命盘时用的那份表单原样带回来，
// 这里重新解析生辰与城市，再按 mode + date 取对应瞬间的天象。
// 本命宫位与四轴前端已经有了，所以只回行星与交叉相位。

import { NextResponse } from "next/server";
import { castTransitChart, TRANSIT_MODES } from "@/lib/astro";

export async function POST(request, { params }) {
  const { id } = await params;
  if (id !== "astro") {
    return NextResponse.json({ error: "该模块没有行运盘" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { inputs, mode, date } = body ?? {};

  if (!TRANSIT_MODES[mode]) {
    return NextResponse.json({ error: "未知的推运方式" }, { status: 400 });
  }

  const { chart, error } = castTransitChart(inputs, { mode, date });
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ chart });
}
