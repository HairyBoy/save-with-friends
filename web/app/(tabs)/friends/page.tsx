"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { TopBar, topBarAvatarClass } from "@/components/TopBar";
import { useFriends } from "@/hooks/useVaults";
import { shortAddress } from "@/lib/friends";

// Add-by-phone (ODIS) is gated: real resolution only works on mainnet (see lib/odis.ts),
// so it stays off on the testnet deploy until ODIS is wired. Flip NEXT_PUBLIC_PHONE_ADD
// to "true" to surface the phone option.
const PHONE_ADD = process.env.NEXT_PUBLIC_PHONE_ADD === "true";

// Friends — your social graph. Add a friend by their wallet address (or phone, when
// enabled); you then pick them as keyholders when creating a vault, and they approve
// an early unlock from their own wallet. Synced across devices via the DB (Phase 2).
export default function FriendsScreen() {
  const { t } = useLanguage();
  const { friends, isLoading, add, addByPhone, remove } = useFriends();

  const [mode, setMode] = useState<"address" | "phone">("address");
  const [nickname, setNickname] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fieldClass =
    "w-full rounded-2xl border border-white/60 bg-white/60 px-4 py-3 text-sm shadow-sm backdrop-blur-md outline-none transition placeholder:text-neutral-400 focus:border-primary/50";
  const modeBtn = (on: boolean) =>
    `flex-1 rounded-xl border px-3 py-2 text-sm font-medium backdrop-blur-md transition ${
      on ? "border-primary bg-primary text-white shadow-sm" : "border-white/60 bg-white/60 text-neutral-700"
    }`;

  const canSubmit = (mode === "phone" ? phone : address).trim() !== "";

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "phone") await addByPhone(nickname, phone);
      else await add(nickname, address);
      setNickname("");
      setAddress("");
      setPhone("");
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "phone-not-configured") setError(t.friends.phoneUnavailable);
      else if (mode === "phone") setError(t.friends.phoneUnresolved);
      else setError(t.friends.invalidAddress);
    } finally {
      setBusy(false);
    }
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

        {/* Add a friend */}
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md"
        >
          <p className="text-sm font-semibold">{t.friends.addTitle}</p>

          {PHONE_ADD && (
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode("address")} aria-pressed={mode === "address"} className={modeBtn(mode === "address")}>
                {t.friends.modeAddress}
              </button>
              <button type="button" onClick={() => setMode("phone")} aria-pressed={mode === "phone"} className={modeBtn(mode === "phone")}>
                {t.friends.modePhone}
              </button>
            </div>
          )}

          <input
            type="text"
            value={nickname}
            maxLength={40}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={t.friends.nicknamePlaceholder}
            className={fieldClass}
          />
          {mode === "phone" ? (
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t.friends.phonePlaceholder}
              className={fieldClass}
            />
          ) : (
            <input
              type="text"
              value={address}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t.friends.addressPlaceholder}
              className={`${fieldClass} font-mono`}
            />
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={!canSubmit || busy}
            className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-3 text-center text-sm font-medium text-white shadow-lg shadow-emerald-600/20 transition disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {t.friends.add}
          </button>
        </form>

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
                <span className="flex flex-1 flex-col">
                  <span className="text-sm font-medium">{f.name}</span>
                  <span className="font-mono text-xs text-neutral-400">{shortAddress(f.address)}</span>
                </span>
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
