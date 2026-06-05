"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { useSavings } from "@/hooks/useVaults";

// My Vaults (home). Bold/immersive emerald theme: a green header band carries
// the title + total saved, vault cards (with fill progress) below.
export default function MyVaultsScreen() {
  const { t, lang } = useLanguage();
  const { vaults, summary, isLoading } = useSavings();

  const numLocale = lang === "es" ? "es-CO" : "en-US";
  const fmt = (n: number) => n.toLocaleString(numLocale, { maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col">
      <header className="rounded-b-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 pt-10 pb-7 text-white shadow-lg shadow-emerald-600/20">
        <h1 className="text-xl font-bold">{t.home.title}</h1>
        <p className="mt-5 text-sm text-white/70">{t.home.totalSaved}</p>
        <p className="text-3xl font-semibold">{summary ? `$${fmt(summary.totalSaved)}` : "—"}</p>
      </header>

      <div className="flex flex-col gap-5 px-5 py-6">
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
