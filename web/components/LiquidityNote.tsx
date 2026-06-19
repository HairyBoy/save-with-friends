"use client";

import { useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

// A small, tappable caveat shown on earning (Aave-yield) vaults: withdrawals are
// instant in normal conditions but ultimately depend on Aave's pool liquidity. Tap
// for the full explanation in a bottom-sheet popup. Kept tiny on purpose.
export function LiquidityNote() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex items-center gap-1 text-xs text-neutral-400 underline-offset-2 hover:underline"
      >
        <span aria-hidden>ⓘ</span> {t.vaultDetail.earnLiquidityNote}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-white/60 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-neutral-900">{t.vaultDetail.earnLiquidityTitle}</p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{t.vaultDetail.earnLiquidityBody}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-3 text-center text-sm font-medium text-white shadow-sm"
            >
              {t.vaultDetail.earnLiquidityClose}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
