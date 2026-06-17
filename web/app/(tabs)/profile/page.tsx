"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { LanguageToggle } from "@/components/LanguageToggle";
import { TopBar, topBarActionClass } from "@/components/TopBar";
import { useWallet } from "@/components/WalletProvider";
import { useBalances } from "@/hooks/useVaults";

// Profile / Me — reached via the home avatar (back action in the top bar).
// Connected account, money balances, settings, legal, support.
export default function ProfileScreen() {
  const { t, lang } = useLanguage();
  const { balances } = useBalances();
  const { address, isConnected, isMiniPay, isConnecting } = useWallet();
  const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;

  const numLocale = lang === "es" ? "es-CO" : "en-US";
  const fmt = (n: number) => n.toLocaleString(numLocale, { maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col">
      <TopBar
        title={t.profile.title}
        left={
          <Link href="/" aria-label={t.home.title} className={topBarActionClass}>
            ←
          </Link>
        }
      />

      <div className="flex flex-col gap-5 px-5 py-6">
        <section className="rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t.profile.account}</p>
            {isMiniPay && (
              <span className="rounded-full bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary-dark">
                MiniPay
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-neutral-500">
            {isConnecting
              ? t.profile.connecting
              : isConnected && shortAddr
                ? shortAddr
                : t.profile.notConnected}
          </p>
        </section>

        <section className="rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
          <p className="text-sm font-semibold">{t.profile.balancesTitle}</p>
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-600">{t.profile.personalVaults}</p>
              <p className="text-sm font-medium text-neutral-700">
                {balances ? `$${fmt(balances.personal)}` : "—"}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-600">{t.profile.sharedReceiving}</p>
              <p className="text-sm font-medium text-neutral-700">
                {balances ? `$${fmt(balances.sharedReceiving)}` : "—"}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-600">{t.profile.walletBalance}</p>
              <p className="text-sm font-medium text-neutral-700">
                {balances ? `$${fmt(balances.wallet)}` : "—"}
              </p>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-neutral-200 pt-2.5">
              <p className="text-sm font-semibold">{t.profile.totalBalance}</p>
              <p className="text-base font-semibold text-primary-dark">
                {balances ? `$${fmt(balances.total)}` : "—"}
              </p>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
            <p className="text-sm font-medium">{t.profile.language}</p>
            <LanguageToggle />
          </div>
          <p className="rounded-2xl border border-white/60 bg-white/60 p-4 text-sm shadow-sm backdrop-blur-md">
            {t.profile.terms}
          </p>
          <p className="rounded-2xl border border-white/60 bg-white/60 p-4 text-sm shadow-sm backdrop-blur-md">
            {t.profile.support}
          </p>
        </section>

        <Link href="/onboarding" className="text-center text-sm text-neutral-400 underline">
          {t.profile.viewOnboarding}
        </Link>
      </div>
    </div>
  );
}
