"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

// Create a PiggyBank (full-screen flow, no tab bar).
// Real flow later: name → target amount → deadline → accountability friends.
export default function CreatePiggyBankScreen() {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-dvh flex-col gap-6 px-5 py-6">
      <Link href="/" className="text-sm text-neutral-400">
        ← {t.create.cancel}
      </Link>

      <header>
        <h1 className="text-xl font-bold">{t.create.title}</h1>
      </header>

      <section className="flex flex-col gap-3">
        <p className="rounded-lg border border-neutral-200 p-4 text-sm">{t.create.step1}</p>
        <p className="rounded-lg border border-neutral-200 p-4 text-sm">{t.create.step2}</p>
        <p className="rounded-lg border border-neutral-200 p-4 text-sm">{t.create.step3}</p>
        <p className="rounded-lg border border-neutral-200 p-4 text-sm">{t.create.step4}</p>
      </section>

      <button
        type="button"
        className="mt-auto rounded-lg bg-neutral-900 p-4 text-center text-sm font-medium text-white"
      >
        {t.create.submit}
      </button>
    </div>
  );
}
