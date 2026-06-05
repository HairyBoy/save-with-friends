"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";

// A friend's PiggyBank (read-only + encouragement).
export default function FriendDetailScreen() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="rounded-b-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 pt-8 pb-7 text-white shadow-lg shadow-emerald-600/20">
        <Link href="/friends" className="text-sm text-white/70">
          ← {t.friendDetail.back}
        </Link>
        <h1 className="mt-4 text-xl font-bold">
          {t.friendDetail.titlePrefix} {id}
        </h1>
        <p className="text-sm text-white/70">{t.friendDetail.progress}</p>
      </header>

      <div className="flex flex-1 flex-col gap-5 px-5 py-6">
        <section className="rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
          <p className="text-sm text-neutral-600">{t.friendDetail.statusLine}</p>
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
