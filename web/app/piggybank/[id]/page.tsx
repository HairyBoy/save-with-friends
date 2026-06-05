"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";

// PiggyBank detail (full-screen push, no tab bar).
export default function PiggyBankDetailScreen() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex min-h-dvh flex-col gap-6 px-5 py-6">
      <Link href="/" className="text-sm text-neutral-400">
        ← {t.piggybankDetail.back}
      </Link>

      <header>
        <h1 className="text-xl font-bold">
          {t.piggybankDetail.titlePrefix}
          {id}
        </h1>
        <p className="text-sm text-neutral-500">{t.piggybankDetail.namePlaceholder}</p>
      </header>

      <section className="rounded-lg border border-neutral-200 p-4 text-center">
        <p className="text-sm text-neutral-500">{t.piggybankDetail.pigPlaceholder}</p>
        <p className="text-2xl font-semibold">{t.piggybankDetail.savedGoal}</p>
      </section>

      <section className="rounded-lg border border-neutral-200 p-4">
        <p className="text-sm font-medium">{t.piggybankDetail.unlocksWhen}</p>
        <p className="text-sm text-neutral-500">{t.piggybankDetail.goalReached}</p>
        <p className="text-sm text-neutral-500">{t.piggybankDetail.timerEnds}</p>
        <p className="text-sm text-neutral-500">{t.piggybankDetail.friendApproves}</p>
      </section>

      <section className="rounded-lg border border-neutral-200 p-4">
        <p className="text-sm font-medium">{t.piggybankDetail.yieldEarned}</p>
        <p className="text-sm text-neutral-500">{t.piggybankDetail.yieldBody}</p>
      </section>

      <div className="mt-auto flex flex-col gap-2">
        <button
          type="button"
          className="rounded-lg bg-neutral-900 p-4 text-center text-sm font-medium text-white"
        >
          {t.piggybankDetail.deposit}
        </button>
        <button
          type="button"
          className="rounded-lg border border-neutral-200 p-4 text-center text-sm"
        >
          {t.piggybankDetail.requestEarlyExit}
        </button>
      </div>
    </div>
  );
}
