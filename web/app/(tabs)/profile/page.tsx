"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { LanguageToggle } from "@/components/LanguageToggle";

// Profile / Me — account hint, settings, legal, support. The language setting is
// the first real setting here; the rest stay placeholders for now.
export default function ProfileScreen() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col">
      <header className="rounded-b-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 pt-10 pb-7 text-white shadow-lg shadow-emerald-600/20">
        <h1 className="text-xl font-bold">{t.profile.title}</h1>
        <p className="mt-5 text-sm text-white/70">{t.profile.account}</p>
        <p className="text-sm font-medium">{t.profile.addressHint}</p>
      </header>

      <div className="flex flex-col gap-5 px-5 py-6">
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
