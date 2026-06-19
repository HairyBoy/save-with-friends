"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { TopBar, topBarAvatarClass } from "@/components/TopBar";
import { useWallet } from "@/components/WalletProvider";
import { useDailyPrize } from "@/hooks/useVaults";
import { currentWindow } from "@/lib/raffle";

// Prize — today's daily COPm prize + this user's odds (raffle weighted by the
// amount locked today), a live countdown to the noon-Bogotá draw, and recent
// winners. Entries are real (derived from on-chain deposits via /api/raffle);
// winners are empty until the draw job (P2) starts recording them.
export default function PrizeScreen() {
  const { t, lang } = useLanguage();
  const { address } = useWallet();
  const { prize } = useDailyPrize();

  const numLocale = lang === "es" ? "es-CO" : "en-US";
  const fmt = (n: number) => n.toLocaleString(numLocale, { maximumFractionDigits: 2 });
  const usd = (n: number) => `$${fmt(n)}`;

  // Countdown + window, computed from the WALL clock (the draw cron fires at
  // 17:00 UTC, so the user's clock is the right basis — not the chain clock, which
  // can drift on the dev chain). `nowMs` starts null and is set asynchronously, so
  // SSR and the first client render agree (no hydration mismatch). The window's
  // draw boundary is the next noon-Bogotá from `currentWindow`.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  const drawAtMs = nowMs != null ? currentWindow(Math.floor(nowMs / 1000)).drawAt * 1000 : null;
  const secsLeft =
    drawAtMs != null && nowMs != null ? Math.max(0, Math.round((drawAtMs - nowMs) / 1000)) : null;
  const windowStartMs = drawAtMs != null ? drawAtMs - 24 * 60 * 60 * 1000 : null;

  // Window range formatted with no explicit timeZone → the browser renders it in
  // the user's own local clock; 24-hour to match the countdown.
  const fmtWhen = (ms: number) =>
    new Date(ms).toLocaleString(numLocale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  // Winners are shown as truncated pseudonymous addresses (already public on-chain);
  // the app otherwise shows names, but raffle winners are deliberately address-only.
  const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

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
        {prize?.youWonCopm != null && (
          <section className="rounded-2xl border border-primary bg-primary p-5 text-center text-white shadow-md">
            <p className="text-base font-bold">
              {t.prize.youWon.replace("{amount}", fmt(prize.youWonCopm))}
            </p>
          </section>
        )}

        {prize && !prize.funded && (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-center">
            <p className="text-sm font-medium text-amber-800">{t.prize.notFunded}</p>
          </section>
        )}

        <section className="rounded-2xl border border-primary-light/60 bg-primary-tint/70 p-5 text-center shadow-sm backdrop-blur-md">
          <p className="text-sm font-medium text-neutral-600">{t.prize.prizeToday}</p>
          <p className="mt-1 text-4xl font-bold text-primary-dark">
            🎁 {prize ? `${fmt(prize.amountCopm)} COPm` : "—"}
          </p>
          <p className="mt-3 text-xs font-medium text-neutral-500">{t.prize.nextDraw}</p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-primary-dark">
            {secsLeft != null ? fmtCountdown(secsLeft) : "—"}
          </p>
          <p className="mt-3 text-xs font-medium text-neutral-500">{t.prize.windowLabel}</p>
          <p className="text-xs text-neutral-600">
            {windowStartMs != null && drawAtMs != null
              ? `${fmtWhen(windowStartMs)} – ${fmtWhen(drawAtMs)}`
              : "—"}
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
          <dl className="mt-3 flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-neutral-500">{t.prize.yourDeposits}</dt>
              <dd className="font-semibold text-neutral-700">
                {prize ? usd(prize.yourDepositsUsd) : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-500">{t.prize.totalDeposits}</dt>
              <dd className="font-semibold text-neutral-700">
                {prize ? usd(prize.totalDepositsUsd) : "—"}
              </dd>
            </div>
          </dl>
          {prize?.disqualified && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              {t.prize.disqualifiedNote}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-white/60 bg-white/60 p-5 shadow-sm backdrop-blur-md">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-neutral-600">{t.prize.copmBalanceLabel}</p>
            <p className="text-2xl font-bold text-primary-dark">
              {prize ? `${fmt(prize.yourCopmBalance)} COPm` : "—"}
            </p>
          </div>
          <p className="mt-1 text-xs text-neutral-500">{t.prize.copmBalanceNote}</p>
        </section>

        <section className="rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
          <p className="text-sm font-semibold">{t.prize.howItWorksTitle}</p>
          <p className="mt-1 text-sm text-neutral-600">{t.prize.howItWorksBody}</p>
        </section>

        <section className="rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
          <p className="text-sm font-semibold">{t.prize.winnersTitle}</p>
          {prize && prize.winners.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-2">
              {prize.winners.map((w) => {
                const isYou = !!address && w.address.toLowerCase() === address.toLowerCase();
                return (
                <li
                  key={`${w.drawAt}-${w.address}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span
                    className={`font-mono ${isYou ? "font-semibold text-primary-dark" : "text-neutral-700"}`}
                  >
                    🏆 {isYou ? t.prize.you : shortAddr(w.address)}
                  </span>
                  <span className="text-right">
                    <span className="font-semibold text-primary-dark">
                      {fmt(w.amountCopm)} COPm
                    </span>
                    <span className="ml-2 text-xs text-neutral-400">
                      {new Date(w.drawAt * 1000).toLocaleDateString(numLocale)}
                    </span>
                  </span>
                </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-neutral-500">{t.prize.noWinners}</p>
          )}
        </section>

        <p className="text-center text-xs text-neutral-400">{t.prize.drawNote}</p>
      </div>
    </div>
  );
}

// Seconds → "HH:MM:SS" for the draw countdown.
function fmtCountdown(secs: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
