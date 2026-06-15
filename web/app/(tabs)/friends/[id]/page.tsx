"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { TopBar, topBarActionClass } from "@/components/TopBar";

// A friend's Vault (read-only + encouragement).
export default function FriendDetailScreen() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        title={`${t.friendDetail.titlePrefix} ${id}`}
        left={
          <Link href="/friends" aria-label={t.friendDetail.back} className={topBarActionClass}>
            ←
          </Link>
        }
      />

      <div className="flex flex-1 flex-col gap-5 px-5 py-6">
        <section className="rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
          <p className="text-sm text-neutral-500">{t.friendDetail.progress}</p>
          <p className="mt-1 text-sm text-neutral-600">{t.friendDetail.statusLine}</p>
        </section>

        <button
          type="button"
          className="mt-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-center text-sm font-medium text-white shadow-lg shadow-emerald-600/20"
        >
          {t.friendDetail.cheer}
        </button>
      </div>
    </div>
  );
}
