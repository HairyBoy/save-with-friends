"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

// Create a PiggyBank (full-screen flow, no tab bar).
// Real flow later: name → target amount → deadline → accountability friends.
export default function CreatePiggyBankScreen() {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="rounded-b-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 pt-8 pb-7 text-white shadow-lg shadow-emerald-600/20">
        <Link href="/" className="text-sm text-white/70">
          ← {t.create.cancel}
        </Link>
        <h1 className="mt-4 text-xl font-bold">{t.create.title}</h1>
      </header>

      <div className="flex flex-1 flex-col gap-6 px-5 py-6">
        <section className="flex flex-col gap-3">
          <p className="rounded-2xl border border-white/60 bg-white/60 p-4 text-sm shadow-sm backdrop-blur-md">
            {t.create.step1}
          </p>
          <p className="rounded-2xl border border-white/60 bg-white/60 p-4 text-sm shadow-sm backdrop-blur-md">
            {t.create.step2}
          </p>
          <p className="rounded-2xl border border-white/60 bg-white/60 p-4 text-sm shadow-sm backdrop-blur-md">
            {t.create.step3}
          </p>
          <p className="rounded-2xl border border-white/60 bg-white/60 p-4 text-sm shadow-sm backdrop-blur-md">
            {t.create.step4}
          </p>
        </section>

        <button
          type="button"
          className="mt-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-center text-sm font-medium text-white shadow-lg shadow-emerald-600/20"
        >
          {t.create.submit}
        </button>
      </div>
    </div>
  );
}
