"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { TopBar, topBarAvatarClass } from "@/components/TopBar";
import { useDailyPrize } from "@/hooks/useVaults";

// Prize — today's daily COPm prize + this user's odds (raffle weighted by the
// amount locked today). Data is stubbed via the data layer for now.
export default function PrizeScreen() {
  const { t, lang } = useLanguage();
  const { prize } = useDailyPrize();

  const numLocale = lang === "es" ? "es-CO" : "en-US";
  const fmt = (n: number) => n.toLocaleString(numLocale);

  return (
    <div className="flex flex-col">
      <TopBar
        title={t.prize.title}
        right={
          <Link href="/profile" aria-label={t.nav.me} className={topBarAvatarClass}>
            👤
          </Link>
        }
      />

      <div className="flex flex-col gap-5 px-5 py-6">
        <section className="rounded-2xl border border-primary-light/60 bg-primary-tint/70 p-5 text-center shadow-sm backdrop-blur-md">
          <p className="text-sm font-medium text-neutral-600">{t.prize.prizeToday}</p>
          <p className="mt-1 text-4xl font-bold text-primary-dark">
            🎁 {prize ? `${fmt(prize.amountCopm)} COPm` : "—"}
          </p>
        </section>

        <section className="rounded-2xl border border-white/60 bg-white/60 p-5 text-center shadow-sm backdrop-blur-md">
          <p className="text-sm font-medium text-neutral-600">{t.prize.yourChance}</p>
          <p className="mt-1 text-4xl font-bold text-primary-dark">
            {prize ? `${prize.winChancePct}%` : "—"}
          </p>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-primary-tint">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${prize?.winChancePct ?? 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            {t.prize.entriesLabel}:{" "}
            {prize ? `${fmt(prize.yourEntries)} / ${fmt(prize.totalEntries)}` : "—"}
          </p>
        </section>

        <section className="rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
          <p className="text-sm font-semibold">{t.prize.howItWorksTitle}</p>
          <p className="mt-1 text-sm text-neutral-600">{t.prize.howItWorksBody}</p>
        </section>

        <p className="text-center text-xs text-neutral-400">{t.prize.drawNote}</p>
      </div>
    </div>
  );
}
