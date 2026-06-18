"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { useWallet } from "@/components/WalletProvider";
import { acceptFriendInvite, getInvite, type InviteInfo } from "@/lib/vaults";

// Invite accept screen (full-screen, no tab bar). A friend opens the shared link in
// MiniPay → their wallet auto-connects → they confirm their name → mutual friendship.
// No addresses anywhere; identity is the self-chosen name.
export default function InviteAcceptScreen() {
  const { t } = useLanguage();
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { isConnected, isConnecting } = useWallet();

  const [invite, setInvite] = useState<InviteInfo | null | "invalid">(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    getInvite(token).then((info) => {
      if (active) setInvite(info ?? "invalid");
    });
    return () => {
      active = false;
    };
  }, [token]);

  async function accept() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await acceptFriendInvite(token, name.trim());
      setDone(true);
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setError(
        m === "self"
          ? t.invite.selfError
          : m === "expired"
            ? t.invite.expired
            : m === "no-wallet"
              ? t.invite.connectPrompt
              : t.invite.acceptError,
      );
    } finally {
      setBusy(false);
    }
  }

  const card =
    "w-full rounded-2xl border border-white/60 bg-white/70 p-6 text-center shadow-sm backdrop-blur-md";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 py-10">
      {invite === null ? (
        <div className={`${card} animate-pulse text-neutral-400`}>…</div>
      ) : invite === "invalid" ? (
        <div className={card}>
          <p className="text-2xl">🔗</p>
          <p className="mt-2 text-sm text-neutral-600">{t.invite.invalid}</p>
        </div>
      ) : invite.expired ? (
        <div className={card}>
          <p className="text-2xl">⌛</p>
          <p className="mt-2 text-sm text-neutral-600">{t.invite.expired}</p>
        </div>
      ) : done ? (
        <div className={card}>
          <p className="text-3xl">🎉</p>
          <p className="mt-2 text-base font-semibold text-primary-dark">{t.invite.success}</p>
          <button
            type="button"
            onClick={() => router.push("/friends")}
            className="mt-4 w-full rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-3 text-sm font-medium text-white shadow-lg shadow-emerald-600/20"
          >
            {t.invite.goToFriends}
          </button>
        </div>
      ) : (
        <div className={card}>
          <p className="text-3xl">👋</p>
          <p className="mt-2 text-lg font-semibold text-neutral-900">
            {invite.inviterName ?? t.friends.unnamedFriend}
          </p>
          <p className="mt-1 text-sm text-neutral-600">{t.invite.invitedYou}</p>

          {!isConnected ? (
            <p className="mt-4 text-sm text-amber-700">
              {isConnecting ? t.profile.connecting : t.invite.connectPrompt}
            </p>
          ) : (
            <>
              <label htmlFor="invite-name" className="mt-5 block text-left text-sm font-medium text-neutral-700">
                {t.invite.namePrompt}
              </label>
              <input
                id="invite-name"
                type="text"
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.invite.namePlaceholder}
                className="mt-1.5 w-full rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-primary/50"
              />
              {error && <p className="mt-2 text-left text-xs text-red-500">{error}</p>}
              <button
                type="button"
                onClick={accept}
                disabled={!name.trim() || busy}
                className="mt-4 w-full rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-3 text-sm font-medium text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                {busy ? t.invite.accepting : t.invite.accept}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
