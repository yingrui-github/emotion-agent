import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="font-display text-3xl text-gold">没有这个模块</p>
      <Link href="/" className="mt-4 text-sm text-fg/40 transition hover:text-fg/80">
        ← 回首页
      </Link>
    </div>
  );
}
