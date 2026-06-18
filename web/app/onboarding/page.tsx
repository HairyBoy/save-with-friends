"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useMyName } from "@/hooks/useVaults";

// Onboarding / Welcome (first run). MiniPay connects with zero clicks, so this is
// a splash, not a login form: pick your language and set the display name your
// friends will see. The name is editable later on the Me page; it's not unique.
export default function OnboardingScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const { name, save } = useMyName();

  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const value = draft ?? name ?? "";

  async function start() {
    setBusy(true);
    // Best-effort: save the name if entered (needs the wallet connected); proceed
    // regardless — it can be set later on the Me page.
    if (value.trim()) {
      try {
        await save(value);
      } catch {
        /* not connected yet — they'll set it on Me */
      }
    }
    if (typeof window !== "undefined") localStorage.setItem("swf-onboarded", "1");
    router.push("/");
  }

  return (
    <div className="flex min-h-dvh flex-col gap-6 px-5 py-10">
      <div className="flex justify-center">
        <LanguageToggle />
      </div>

      <div className="flex flex-1 flex-col justify-center gap-4 text-center">
        <p className="text-5xl">🏦</p>
        <h1 className="text-2xl font-bold">{t.onboarding.brand}</h1>
        <p className="text-sm text-neutral-500">{t.onboarding.valueProp}</p>

        <div className="mt-2 text-left">
          <label htmlFor="ob-name" className="text-sm font-medium text-neutral-700">
            {t.onboarding.nameLabel}
          </label>
          <input
            id="ob-name"
            type="text"
            maxLength={40}
            value={value}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.onboarding.namePlaceholder}
            className="mt-1.5 w-full rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-primary/50"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-center text-sm font-medium text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50"
      >
        {t.onboarding.getStarted}
      </button>
    </div>
  );
}
