"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { MINIPAY_DEEPLINKS } from "@/lib/minipay";

// The one place "you don't have enough money" is shown. Every amount input that
// can exceed the wallet balance should render this instead of hand-rolling the
// message — that keeps the MiniPay-required Add Cash redirect (readiness §6)
// wired no matter how many new deposit/contribute flows get added later.
//
// When `over` is true it shows the insufficient-funds message AND an "Add money"
// action that deeplinks into MiniPay's top-up flow, so the user is never
// dead-ended. Otherwise it shows the optional `hint`.
export function BalanceNotice({
  over,
  available,
  hint = "",
  hintError = false,
}: {
  over: boolean;
  available: number | null;
  hint?: string;
  /** Show the (non-over) hint in the error color — e.g. amount below the minimum. */
  hintError?: boolean;
}) {
  const { t, lang } = useLanguage();
  const numLocale = lang === "es" ? "es-CO" : "en-US";
  const fmt = (n: number) => n.toLocaleString(numLocale, { maximumFractionDigits: 2 });
  const isError = over || hintError;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className={`text-xs ${isError ? "text-red-500" : "text-neutral-400"}`}>
          {over ? t.create.insufficientFunds : hint}
        </p>
        {available !== null && (
          <p className={`shrink-0 text-xs ${over ? "text-red-500" : "text-neutral-400"}`}>
            {t.create.available}: ${fmt(available)}
          </p>
        )}
      </div>

      {over && (
        <a
          href={MINIPAY_DEEPLINKS.addCash}
          className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          {t.create.addMoney}
        </a>
      )}
    </div>
  );
}
