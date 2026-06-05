"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { LanguageToggle } from "@/components/LanguageToggle";

// Onboarding / Welcome (first run). MiniPay connects with zero clicks, so this is
// a value-prop splash, not a login form. The language flipper lives up top so the
// very first thing a user can do is pick their language — it drives the whole app.
export default function OnboardingScreen() {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-dvh flex-col gap-6 px-5 py-10">
      <div className="flex justify-center">
        <LanguageToggle />
      </div>

      <div className="flex flex-1 flex-col justify-center gap-4 text-center">
        <p className="text-5xl">🐷</p>
        <h1 className="text-2xl font-bold">{t.onboarding.brand}</h1>
        <p className="text-sm text-neutral-500">{t.onboarding.valueProp}</p>
      </div>

      <Link
        href="/"
        className="rounded-lg bg-neutral-900 p-4 text-center text-sm font-medium text-white"
      >
        {t.onboarding.getStarted}
      </Link>
    </div>
  );
}
