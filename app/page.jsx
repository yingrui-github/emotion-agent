import AgentConsole from "@/components/AgentConsole";
import ModuleCard from "@/components/ModuleCard";
import { MODULES } from "@/lib/modules";

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-2xl text-center">
        <p className="mb-4 text-xs tracking-[.35em] text-gold/60">你的情感与命理伙伴</p>
        <h1 className="font-display text-3xl leading-snug sm:text-4xl">说出你此刻的困惑</h1>
        <p className="mt-4 text-sm leading-relaxed text-fg/45">
          我会听懂它属于哪一层，再带你走进对应的模块。
        </p>

        <AgentConsole />
      </section>

      {/* 3 个独立子功能 */}
      <section className="mt-16" aria-labelledby="modules-heading">
        <div className="mb-6 flex items-baseline justify-between border-b border-fg/8 pb-3">
          <h2 id="modules-heading" className="font-display text-lg tracking-wider text-fg/70">
            三个入口
          </h2>
          <span className="text-xs text-fg/25">也可以直接选一个开始</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <ModuleCard key={m.id} module={m} />
          ))}
        </div>
      </section>
    </>
  );
}
