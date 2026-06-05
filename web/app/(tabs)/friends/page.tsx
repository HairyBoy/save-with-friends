"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { useFriends } from "@/hooks/useVaults";

// Friends — social feed + pending early-exit approvals.
export default function FriendsScreen() {
  const { t } = useLanguage();
  const { friends, isLoading } = useFriends();

  return (
    <div className="flex flex-col">
      <header className="rounded-b-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 pt-10 pb-7 text-white shadow-lg shadow-emerald-600/20">
        <h1 className="text-xl font-bold">{t.friends.title}</h1>
      </header>

      <div className="flex flex-col gap-5 px-5 py-6">
        <section className="rounded-2xl border border-primary-light/60 bg-primary-tint/70 p-4 shadow-sm backdrop-blur-md">
          <p className="text-sm font-semibold text-primary-dark">{t.friends.pendingApprovals}</p>
          <p className="mt-1 text-sm text-neutral-600">{t.friends.pendingBody}</p>
        </section>

        <section className="flex flex-col gap-2.5">
          <p className="text-sm font-medium text-neutral-700">{t.friends.activity}</p>
          {isLoading
            ? [0, 1].map((i) => (
                <div
                  key={i}
                  className="h-[58px] animate-pulse rounded-2xl border border-white/60 bg-white/60"
                />
              ))
            : friends.map((f) => (
                <Link
                  key={f.id}
                  href={`/friends/${f.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-tint text-lg">
                    👤
                  </span>
                  <span className="flex-1 text-sm font-medium">{f.name}</span>
                  <span className="text-sm text-neutral-400">{t.friends.recentActivity}</span>
                </Link>
              ))}
        </section>
      </div>
    </div>
  );
}
