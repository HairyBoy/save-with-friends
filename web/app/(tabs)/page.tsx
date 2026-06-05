"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

// My Vaults (home). Bold/immersive emerald theme: a green header band carries
// the title + total saved, tinted cards below. Real data still placeholdered.
export default function MyVaultsScreen() {
  const { t } = useLanguage();

  // Stubbed list so navigation into the detail screen is wired up.
  const vaults = [
    { id: "1", name: "Trip to Cartagena" },
    { id: "2", name: "New laptop" },
  ];

  return (
    <div className="flex flex-col">
      <header className="rounded-b-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 pt-10 pb-7 text-white shadow-lg shadow-emerald-600/20">
        <h1 className="text-xl font-bold">{t.home.title}</h1>
        <p className="mt-5 text-sm text-white/70">{t.home.totalSaved}</p>
        <p className="text-3xl font-semibold">{t.home.totalAmount}</p>
      </header>

      <div className="flex flex-col gap-5 px-5 py-6">
        <section className="rounded-2xl border border-primary-light/60 bg-primary-tint/70 p-4 shadow-sm backdrop-blur-md">
          <p className="text-sm font-semibold text-primary-dark">{t.home.agentUpdate}</p>
          <p className="mt-1 text-sm text-neutral-600">{t.home.agentUpdateBody}</p>
        </section>

        <section className="flex flex-col gap-2.5">
          <p className="text-sm font-medium text-neutral-700">{t.home.yourVaults}</p>
          {vaults.map((v) => (
            <Link
              key={v.id}
              href={`/vault/${v.id}`}
              className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-tint text-lg">
                🐷
              </span>
              <span className="flex-1 text-sm font-medium">{v.name}</span>
              <span className="text-sm font-medium text-primary">{t.home.details} →</span>
            </Link>
          ))}
          <Link
            href="/create"
            className="rounded-2xl border border-dashed border-primary/40 bg-white/40 p-4 text-center text-sm font-medium text-primary-dark backdrop-blur-md"
          >
            ➕ {t.home.create}
          </Link>
        </section>
      </div>
    </div>
  );
}
