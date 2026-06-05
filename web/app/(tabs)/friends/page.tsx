"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

// Friends — social feed + pending early-exit approvals.
export default function FriendsScreen() {
  const { t } = useLanguage();

  const friends = [
    { id: "ana", name: "Ana" },
    { id: "luis", name: "Luis" },
  ];

  return (
    <div className="flex flex-col gap-6 px-5 py-6">
      <header>
        <h1 className="text-xl font-bold">{t.friends.title}</h1>
      </header>

      <section className="rounded-lg border border-neutral-200 p-4">
        <p className="text-sm font-medium">{t.friends.pendingApprovals}</p>
        <p className="text-sm text-neutral-500">{t.friends.pendingBody}</p>
      </section>

      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t.friends.activity}</p>
        {friends.map((f) => (
          <Link
            key={f.id}
            href={`/friends/${f.id}`}
            className="rounded-lg border border-neutral-200 p-4 text-sm"
          >
            👤 {f.name} <span className="text-neutral-400">{t.friends.recentActivity}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
