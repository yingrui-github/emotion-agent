import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

export const metadata = {
  title: "灵犀 · 情感 Agent",
  description: "一个主 Agent 输入框 + 3 个独立子功能模块：命盘、星盘、合盘。",
};

const VERSION = "0.1.0";

// 在 paint 前定好主题，否则深色用户刷新会先闪一帧浅色。必须内联同步执行。
const THEME_SCRIPT = `try{document.documentElement.dataset.theme=localStorage.getItem("lingxi-theme")==="dark"?"dark":"light"}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body
        className="starfield min-h-screen bg-page font-sans text-fg/90
                   bg-[image:var(--page-glow)]"
      >
        <div className="relative z-10 flex min-h-screen flex-col">
          <header className="border-b border-fg/8 backdrop-blur-sm">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
              <Link href="/" className="group flex items-baseline gap-2.5">
                <span className="font-display text-2xl tracking-[.2em] text-gold">灵犀</span>
                <span className="text-xs tracking-widest text-fg/35 group-hover:text-fg/60">
                  EMOTION&nbsp;AGENT
                </span>
              </Link>
              <div className="flex items-center gap-5">
                <SiteNav />
                <ThemeToggle />
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 sm:py-14">{children}</main>

          <footer className="border-t border-fg/8 px-6 py-6 text-center text-xs text-fg/25">
            灵犀 v{VERSION} · 命盘解读、星盘解读、关系合盘均为真实排盘
          </footer>
        </div>
      </body>
    </html>
  );
}
