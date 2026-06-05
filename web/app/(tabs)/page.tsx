"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

// My PiggyBanks (home). Plain-text placeholders — design + real data later.
export default function MyPiggyBanksScreen() {
  const { t } = useLanguage();

  // Stubbed list so navigation into the detail screen is wired up.
  const piggyBanks = [
    { id: "1", name: "Trip to Cartagena" },
    { id: "2", name: "New laptop" },
  ];

  return (
    <div className="flex flex-col gap-6 px-5 py-6">
      <header>
        <h1 className="text-xl font-bold">{t.home.title}</h1>
      </header>

      <section className="rounded-lg border border-neutral-200 p-4">
        <p className="text-sm text-neutral-500">{t.home.totalSaved}</p>
        <p className="text-2xl font-semibold">{t.home.totalAmount}</p>
      </section>

      <section className="rounded-lg border border-neutral-200 p-4">
        <p className="text-sm font-medium">{t.home.agentUpdate}</p>
        <p className="text-sm text-neutral-500">{t.home.agentUpdateBody}</p>
      </section>

      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t.home.yourPiggyBanks}</p>
        {piggyBanks.map((pb) => (
          <Link
            key={pb.id}
            href={`/piggybank/${pb.id}`}
            className="rounded-lg border border-neutral-200 p-4 text-sm"
          >
            🐷 {pb.name} <span className="text-neutral-400">→ {t.home.details}</span>
          </Link>
        ))}
        <Link
          href="/create"
          className="rounded-lg border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-500"
        >
          ➕ {t.home.create}
        </Link>
      </section>
    </div>
  );
}
