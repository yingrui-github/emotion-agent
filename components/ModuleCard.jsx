import Link from "next/link";

import { accentText } from "@/lib/modules";

/** 首页网格里的模块入口卡片。纯展示，无需客户端状态。 */
export default function ModuleCard({ module: m }) {
  return (
    <Link
      href={`/m/${m.id}`}
      className="glow group relative overflow-hidden rounded-2xl border border-fg/10
                 bg-fg/[.03] p-5 backdrop-blur hover:border-fg/25"
      style={{ "--glow-color": `${m.accent}80` }}
    >
      <div
        className="pointer-events-none absolute right-4 top-3 text-[64px] leading-none
                   opacity-[.06] transition group-hover:opacity-[.13]"
        style={{ color: accentText(m.accent) }}
        aria-hidden="true"
      >
        {m.glyph}
      </div>
      <div className="relative">
        <span className="text-2xl" style={{ color: accentText(m.accent) }} aria-hidden="true">
          {m.glyph}
        </span>
        <h3 className="mt-3 font-display text-lg tracking-wide text-fg/90">{m.name}</h3>
        <p className="mt-1 text-[11px] tracking-widest" style={{ color: accentText(m.accent), opacity: .7 }}>
          {m.tagline}
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-fg/45">{m.desc}</p>
        <span
          className="mt-4 inline-flex items-center gap-1 text-xs text-fg/35
                     transition group-hover:gap-2 group-hover:text-fg/70"
        >
          开始 <span aria-hidden="true">→</span>
        </span>
      </div>
    </Link>
  );
}
