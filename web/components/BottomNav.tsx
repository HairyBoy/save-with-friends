"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";

type Tab = {
  href: string;
  label: string;
  icon: string;
  /** Highlight when the path starts with href (vs. exact match for "/"). */
  match: (pathname: string) => boolean;
};

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const tabs: Tab[] = [
    { href: "/", label: t.nav.mine, icon: "🐷", match: (p) => p === "/" },
    { href: "/create", label: t.nav.create, icon: "➕", match: (p) => p.startsWith("/create") },
    { href: "/friends", label: t.nav.friends, icon: "👥", match: (p) => p.startsWith("/friends") },
    { href: "/profile", label: t.nav.me, icon: "👤", match: (p) => p.startsWith("/profile") },
  ];

  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-neutral-200 bg-white">
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] ${
              active ? "font-semibold text-neutral-900" : "text-neutral-400"
            }`}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
