// POST /api/reading/[id] —— 单个模块的推演。
//
// 三个模块都接了真实排盘，没有占位分支之外的实现：
// bazi 四柱 + 大运（lib/bazi.js）、astro 本命星盘（lib/astro.js）、
// synastry 两人合盘（lib/synastry.js）。

import { NextResponse } from "next/server";
import { castAstroChart } from "@/lib/astro";
import { castBaziChart } from "@/lib/bazi";
import { getModule } from "@/lib/modules";
import { castSynastryChart } from "@/lib/synastry";

/** 已接入真实排盘的模块，签名统一为 form → {chart} | {error}。 */
const CASTERS = { bazi: castBaziChart, astro: castAstroChart, synastry: castSynastryChart };

export async function POST(request, { params }) {
  const { id } = await params;
  const m = getModule(id);
  if (!m) {
    return NextResponse.json({ error: "未知模块" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const inputs = Object.fromEntries(
    m.inputs.map(({ name }) => [name, String(body[name] ?? "").trim()]),
  );

  const cast = CASTERS[m.id];
  if (cast) {
    const { chart, error } = cast(inputs);
    // 生辰格式、性别、城市这类输入问题直接回 400，前端把原话显示给用户。
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    return NextResponse.json({ moduleId: m.id, inputs, chart });
  }

  return NextResponse.json({
    moduleId: m.id,
    inputs,
    placeholder: `「${m.name}」的推演逻辑还没接入。这里将输出结构化解读结果。`,
  });
}
