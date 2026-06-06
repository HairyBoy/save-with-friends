"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { TopBar, topBarAvatarClass } from "@/components/TopBar";
import { useSavings } from "@/hooks/useVaults";

// My Vaults (home). Unified top bar (title + avatar → Me); savings stats,
// agent update, and vault cards (with fill progress) live in the body.
export default function MyVaultsScreen() {
  const { t, lang } = useLanguage();
  const { vaults, summary, isLoading } = useSavings();

  const numLocale = lang === "es" ? "es-CO" : "en-US";
  const fmt = (n: number) => n.toLocaleString(numLocale, { maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col">
      <TopBar
        title={t.home.title}
        right={
          <Link href="/profile" aria-label={t.nav.me} className={topBarAvatarClass}>
            👤
          </Link>
        }
      />

      <div className="flex flex-col gap-5 px-5 py-6">
        <section className="flex gap-4 rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
          <div className="flex-1">
            <p className="text-xs text-neutral-500">{t.home.currentlySaving}</p>
            <p className="text-2xl font-semibold text-primary-dark">
              {summary ? `$${fmt(summary.currentlySaving)}` : "—"}
            </p>
          </div>
          <div className="flex-1 border-l border-neutral-200 pl-4">
            <p className="text-xs text-neutral-500">{t.home.savedAllTime}</p>
            <p className="text-2xl font-semibold text-primary-dark">
              {summary ? `$${fmt(summary.savedAllTime)}` : "—"}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-primary-light/60 bg-primary-tint/70 p-4 shadow-sm backdrop-blur-md">
          <p className="text-sm font-semibold text-primary-dark">{t.home.agentUpdate}</p>
          <p className="mt-1 text-sm text-neutral-600">{t.home.agentUpdateBody}</p>
        </section>

        <section className="flex flex-col gap-2.5">
          <p className="text-sm font-medium text-neutral-700">{t.home.yourVaults}</p>

          {isLoading
            ? [0, 1].map((i) => (
                <div
                  key={i}
                  className="h-[78px] animate-pulse rounded-2xl border border-white/60 bg-white/60"
                />
              ))
            : vaults.map((v) => {
                const pct = v.goal > 0 ? Math.min(100, Math.round((v.saved / v.goal) * 100)) : 0;
                return (
                  <Link
                    key={v.id}
                    href={`/vault/${v.id}`}
                    className="flex flex-col gap-3 rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-tint text-lg">
                        {v.icon}
                      </span>
                      <span className="flex-1 text-sm font-medium">{v.name}</span>
                      <span className="text-sm font-medium text-neutral-500">
                        ${fmt(v.saved)} / ${fmt(v.goal)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-primary-tint">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </Link>
                );
              })}

          <Link
            href="/create"
            className="rounded-2xl border border-dashed border-primary/40 bg-white/40 p-4 text-center text-sm font-medium text-primary-dark backdrop-blur-md"
          >
            ➕ {t.home.create}
          </Link>
        </section>
      </div>
    </div>
  );
}
