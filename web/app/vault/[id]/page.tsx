"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { useVault } from "@/hooks/useVaults";

// Vault detail (full-screen push, no tab bar).
export default function VaultDetailScreen() {
  const { t, lang } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const { vault, isLoading } = useVault(id);

  const numLocale = lang === "es" ? "es-CO" : "en-US";
  const fmt = (n: number) => n.toLocaleString(numLocale, { maximumFractionDigits: 2 });
  const pct = vault && vault.goal > 0 ? Math.min(100, Math.round((vault.saved / vault.goal) * 100)) : 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="rounded-b-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 pt-8 pb-7 text-white shadow-lg shadow-emerald-600/20">
        <Link href="/" className="text-sm text-white/70">
          ← {t.vaultDetail.back}
        </Link>
        <h1 className="mt-4 text-xl font-bold">
          {t.vaultDetail.titlePrefix}
          {id}
        </h1>
        <p className="text-sm text-white/70">
          {vault?.name ?? (isLoading ? "…" : t.vaultDetail.namePlaceholder)}
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-5 px-5 py-6">
        {/* Fill progress — the "vault filling up" centerpiece. */}
        <section className="rounded-2xl border border-white/60 bg-white/60 p-5 text-center shadow-sm backdrop-blur-md">
          <p className="text-3xl font-semibold text-primary-dark">${fmt(vault?.saved ?? 0)}</p>
          <p className="mt-1 text-sm text-neutral-400">/ ${fmt(vault?.goal ?? 0)}</p>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-primary-tint">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs font-medium text-neutral-500">{pct}%</p>
        </section>

        <section className="rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
          <p className="text-sm font-semibold">{t.vaultDetail.unlocksWhen}</p>
          <p className="mt-1 text-sm text-neutral-600">{t.vaultDetail.goalReached}</p>
          <p className="text-sm text-neutral-600">{t.vaultDetail.timerEnds}</p>
          <p className="text-sm text-neutral-600">{t.vaultDetail.friendApproves}</p>
        </section>

        <section className="rounded-2xl border border-primary-light/60 bg-primary-tint/70 p-4 shadow-sm backdrop-blur-md">
          <p className="text-sm font-semibold text-primary-dark">{t.vaultDetail.yieldEarned}</p>
          <p className="mt-1 text-sm text-neutral-600">${fmt(vault?.yieldEarned ?? 0)}</p>
        </section>

        <div className="mt-auto flex flex-col gap-2.5">
          <button
            type="button"
            className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-center text-sm font-medium text-white shadow-lg shadow-emerald-600/20"
          >
            {t.vaultDetail.deposit}
          </button>
          <button
            type="button"
            className="rounded-2xl border border-white/60 bg-white/60 p-4 text-center text-sm font-medium shadow-sm backdrop-blur-md"
          >
            {t.vaultDetail.requestEarlyExit}
          </button>
        </div>
      </div>
    </div>
  );
}
