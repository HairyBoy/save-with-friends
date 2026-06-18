"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { TopBar, topBarAvatarClass } from "@/components/TopBar";
import { useFriends } from "@/hooks/useVaults";
import { mintInvite } from "@/lib/vaults";

// Friends — your social graph. You add friends by sharing an invite link (they tap
// it, their wallet connects, you're mutually connected). No addresses are ever typed
// or shown; everyone appears by the name they set on the Me tab.
export default function FriendsScreen() {
  const { t } = useLanguage();
  const { friends, isLoading, remove } = useFriends();
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function invite() {
    setNote(null);
    setError(null);
    setBusy(true);
    let url: string;
    try {
      url = await mintInvite();
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setError(
        m === "set-your-name-first" ? t.friends.setNameFirst : m === "no-wallet" ? t.friends.connectFirst : t.friends.inviteFailed,
      );
      setBusy(false);
      return;
    }
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: t.onboarding.brand, text: t.friends.shareText, url });
      } else {
        await navigator.clipboard.writeText(url);
        setNote(t.friends.linkCopied);
      }
    } catch {
      /* user canceled the share sheet — nothing to do */
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col">
      <TopBar
        title={t.friends.title}
        right={
          <Link href="/profile" aria-label={t.nav.me} className={topBarAvatarClass}>
            👤
          </Link>
        }
      />

      <div className="flex flex-col gap-5 px-5 py-6">
        <section className="rounded-2xl border border-primary-light/60 bg-primary-tint/70 p-4 shadow-sm backdrop-blur-md">
          <p className="text-sm text-neutral-600">{t.friends.intro}</p>
        </section>

        {/* Invite a friend (share a link) */}
        <button
          type="button"
          onClick={invite}
          disabled={busy}
          className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-center text-sm font-medium text-white shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
        >
          {`🔗 ${t.friends.invite}`}
        </button>
        {note && <p className="text-center text-xs text-primary-dark">{note}</p>}
        {error && <p className="text-center text-xs text-red-500">{error}</p>}

        {/* Your friends */}
        <section className="flex flex-col gap-2.5">
          <p className="text-sm font-medium text-neutral-700">{t.friends.yourFriends}</p>
          {isLoading ? (
            [0, 1].map((i) => (
              <div
                key={i}
                className="h-[58px] animate-pulse rounded-2xl border border-white/60 bg-white/60"
              />
            ))
          ) : friends.length === 0 ? (
            <p className="rounded-2xl border border-white/60 bg-white/60 p-4 text-sm text-neutral-400 shadow-sm backdrop-blur-md">
              {t.friends.empty}
            </p>
          ) : (
            friends.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-tint text-lg">
                  👤
                </span>
                <span className="flex-1 text-sm font-medium">{f.name || t.friends.unnamedFriend}</span>
                <button
                  type="button"
                  onClick={() => remove(f.id)}
                  aria-label={t.friends.remove}
                  className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
