"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULES } from "@/lib/modules";

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden gap-6 text-sm text-fg/45 sm:flex">
      {MODULES.map((m) => (
        <Link
          key={m.id}
          href={`/m/${m.id}`}
          className={`transition hover:text-fg/90 ${
            pathname === `/m/${m.id}` ? "text-fg" : ""
          }`}
        >
          {m.name}
        </Link>
      ))}
    </nav>
  );
}
