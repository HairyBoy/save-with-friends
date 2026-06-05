"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { LanguageToggle } from "@/components/LanguageToggle";

// Profile / Me — account hint, settings, legal, support. The language setting is
// the first real setting here; the rest stay placeholders for now.
export default function ProfileScreen() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-6 px-5 py-6">
      <header>
        <h1 className="text-xl font-bold">{t.profile.title}</h1>
      </header>

      <section className="rounded-lg border border-neutral-200 p-4">
        <p className="text-sm font-medium">{t.profile.account}</p>
        <p className="text-sm text-neutral-500">{t.profile.addressHint}</p>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-4">
          <p className="text-sm font-medium">{t.profile.language}</p>
          <LanguageToggle />
        </div>
        <p className="rounded-lg border border-neutral-200 p-4 text-sm">{t.profile.terms}</p>
        <p className="rounded-lg border border-neutral-200 p-4 text-sm">{t.profile.support}</p>
      </section>

      <Link href="/onboarding" className="text-center text-sm text-neutral-400 underline">
        {t.profile.viewOnboarding}
      </Link>
    </div>
  );
}
