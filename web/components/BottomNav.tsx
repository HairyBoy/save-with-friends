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
    { href: "/", label: t.nav.mine, icon: "🏦", match: (p) => p === "/" },
    { href: "/create", label: t.nav.create, icon: "➕", match: (p) => p.startsWith("/create") },
    { href: "/friends", label: t.nav.friends, icon: "👥", match: (p) => p.startsWith("/friends") },
    { href: "/profile", label: t.nav.me, icon: "👤", match: (p) => p.startsWith("/profile") },
  ];

  return (
    // Floating frosted-glass bar: fixed over the content, centered to the frame
    // width. The translucent green + backdrop blur let the page show through.
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[420px] px-4 pb-4">
      <div className="pointer-events-auto flex items-center justify-around gap-1 rounded-2xl border border-white/30 bg-primary/75 p-1.5 shadow-lg shadow-primary/30 backdrop-blur-xl">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] transition-colors ${
                active ? "bg-white/20 font-semibold text-white" : "text-white/60"
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
