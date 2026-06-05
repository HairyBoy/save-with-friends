"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";

// A friend's PiggyBank (read-only + encouragement).
export default function FriendDetailScreen() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex flex-col gap-6 px-5 py-6">
      <Link href="/friends" className="text-sm text-neutral-400">
        ← {t.friendDetail.back}
      </Link>

      <header>
        <h1 className="text-xl font-bold">
          {t.friendDetail.titlePrefix} {id}
        </h1>
        <p className="text-sm text-neutral-500">{t.friendDetail.progress}</p>
      </header>

      <section className="rounded-lg border border-neutral-200 p-4">
        <p className="text-sm text-neutral-500">{t.friendDetail.statusLine}</p>
      </section>

      <button className="rounded-lg border border-neutral-200 p-4 text-sm" type="button">
        {t.friendDetail.cheer}
      </button>
    </div>
  );
}
