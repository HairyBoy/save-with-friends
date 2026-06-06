"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { LanguageToggle } from "@/components/LanguageToggle";
import { TopBar, topBarActionClass } from "@/components/TopBar";

// Profile / Me — reached via the home avatar (back action in the top bar).
// Account hint, settings, legal, support.
export default function ProfileScreen() {
  const { t } = useLanguage();

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
          <p className="text-sm font-medium">{t.profile.account}</p>
          <p className="text-sm text-neutral-500">{t.profile.addressHint}</p>
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
