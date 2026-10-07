// 主题开关：浅色 / 深色两态，默认浅色。
// 实际生效靠 <html data-theme>，两套色值在 app/globals.css。
// 首屏由 layout.jsx 的内联脚本先设好 data-theme，这里只负责后续切换。

"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "lingxi-theme";

const LABEL = { dark: "深色", light: "浅色" };
const GLYPH = { dark: "☾", light: "☀" };

export default function ThemeToggle() {
  // null = 还没读到已存的选择。服务端不知道用户选了什么，挂载后再对齐。
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    setTheme(localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light");
  }, []);

  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const current = theme ?? "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(current === "dark" ? "light" : "dark")}
      title={`主题：${LABEL[current]}（点击切换）`}
      aria-label={`当前${LABEL[current]}主题，点击切换`}
      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-fg/12
                 text-sm text-fg/55 transition hover:border-fg/30 hover:text-fg/90"
    >
      <span aria-hidden="true">{GLYPH[current]}</span>
    </button>
  );
}
