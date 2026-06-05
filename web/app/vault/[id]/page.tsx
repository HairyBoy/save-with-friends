"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";

// Vault detail (full-screen push, no tab bar).
export default function VaultDetailScreen() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();

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
        <p className="text-sm text-white/70">{t.vaultDetail.namePlaceholder}</p>
      </header>

      <div className="flex flex-1 flex-col gap-5 px-5 py-6">
        <section className="rounded-2xl border border-white/60 bg-white/60 p-5 text-center shadow-sm backdrop-blur-md">
          <p className="text-sm text-neutral-500">{t.vaultDetail.pigPlaceholder}</p>
          <p className="mt-1 text-2xl font-semibold text-primary-dark">{t.vaultDetail.savedGoal}</p>
        </section>

        <section className="rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
          <p className="text-sm font-semibold">{t.vaultDetail.unlocksWhen}</p>
          <p className="mt-1 text-sm text-neutral-600">{t.vaultDetail.goalReached}</p>
          <p className="text-sm text-neutral-600">{t.vaultDetail.timerEnds}</p>
          <p className="text-sm text-neutral-600">{t.vaultDetail.friendApproves}</p>
        </section>

        <section className="rounded-2xl border border-primary-light/60 bg-primary-tint/70 p-4 shadow-sm backdrop-blur-md">
          <p className="text-sm font-semibold text-primary-dark">{t.vaultDetail.yieldEarned}</p>
          <p className="mt-1 text-sm text-neutral-600">{t.vaultDetail.yieldBody}</p>
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
