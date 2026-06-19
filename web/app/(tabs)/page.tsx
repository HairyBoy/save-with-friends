"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { TopBar, topBarAvatarClass } from "@/components/TopBar";
import { useSavings, useSharedVaults, useKeyholderVaults } from "@/hooks/useVaults";
import type { Vault, KeyholderVault } from "@/lib/vaults";
import type { SharedVault } from "@/lib/sharedVaults";

// My Vaults (home). Two stats, then vaults grouped into solo
// ("Your Vaults") and "Shared Vaults" (pending invites flagged). First-run lands on
// /onboarding (to pick language + set a display name); deep links like /invite/[token]
// are NOT gated, so an invitee goes straight to accepting.
export default function MyVaultsScreen() {
  const { t, lang } = useLanguage();
  const { vaults, summary, isLoading } = useSavings();
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("swf-onboarded")) {
      router.replace("/onboarding");
    }
  }, [router]);

  const numLocale = lang === "es" ? "es-CO" : "en-US";
  const fmt = (n: number) => n.toLocaleString(numLocale, { maximumFractionDigits: 2 });

  const soloVaults = vaults; // getVaults is solo-only now
  const { sharedVaults } = useSharedVaults();
  const { keyholderVaults } = useKeyholderVaults(); // friends' vaults you can unlock

  // A solo or accepted-shared vault: icon, name (+ members for shared), progress.
  function progressCard(v: Vault) {
    const pct = v.goal > 0 ? Math.min(100, Math.round((v.saved / v.goal) * 100)) : 0;
    return (
      <Link
        key={v.id}
        href={`/vault/${v.id}`}
        className="flex flex-col gap-3 rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-tint text-lg">
            {v.icon}
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium">{v.name}</p>
          </div>
          <span className="text-sm font-medium text-neutral-500">
            ${fmt(v.saved)} / ${fmt(v.goal)}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-primary-tint">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </Link>
    );
  }

  // A real (group) shared vault → links to its own detail route.
  function sharedCard(sv: SharedVault) {
    const pct = sv.goal > 0 ? Math.min(100, Math.round((sv.saved / sv.goal) * 100)) : 0;
    return (
      <Link
        key={sv.id}
        href={`/shared/${sv.id}`}
        className="flex flex-col gap-3 rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-tint text-lg">
            {sv.icon}
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium">{sv.name}</p>
            <p className="text-xs text-neutral-500">👥 {sv.memberCount} {t.home.members}</p>
          </div>
          <span className="text-sm font-medium text-neutral-500">
            ${fmt(sv.saved)} / ${fmt(sv.goal)}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-primary-tint">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </Link>
    );
  }

  // A friend's vault you hold a key for → links to its detail to approve the unlock.
  function keyholderCard(kv: KeyholderVault) {
    const pct = kv.goal > 0 ? Math.min(100, Math.round((kv.saved / kv.goal) * 100)) : 0;
    return (
      <Link
        key={kv.id}
        href={`/vault/${kv.id}`}
        className="flex flex-col gap-3 rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-tint text-lg">
            {kv.icon}
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium">{kv.name}</p>
            <p className="text-xs text-neutral-500">
              🔑 {kv.ownerName ?? t.shared.aFriend} · {t.home.tapToUnlock}
            </p>
          </div>
          <span className="text-sm font-medium text-neutral-500">
            ${fmt(kv.saved)} / ${fmt(kv.goal)}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-primary-tint">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </Link>
    );
  }

  return (
    <div className="flex flex-col">
      <TopBar
        title={t.home.title}
        right={
          <Link href="/profile" aria-label={t.nav.me} className={topBarAvatarClass}>
            👤
          </Link>
        }
      />

      <div className="flex flex-col gap-5 px-5 py-6">
        <section className="flex gap-4 rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
          <div className="flex-1">
            <p className="text-xs text-neutral-500">{t.home.currentlySaving}</p>
            <p className="text-2xl font-semibold text-primary-dark">
              {summary ? `$${fmt(summary.currentlySaving)}` : "—"}
            </p>
          </div>
          <div className="flex-1 border-l border-neutral-200 pl-4">
            <p className="text-xs text-neutral-500">{t.home.savedAllTime}</p>
            <p className="text-2xl font-semibold text-primary-dark">
              {summary ? `$${fmt(summary.savedAllTime)}` : "—"}
            </p>
          </div>
        </section>

        {isLoading ? (
          <div className="flex flex-col gap-2.5">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-[78px] animate-pulse rounded-2xl border border-white/60 bg-white/60"
              />
            ))}
          </div>
        ) : (
          <>
            {soloVaults.length > 0 && (
              <section className="flex flex-col gap-2.5">
                <p className="text-sm font-medium text-neutral-700">{t.home.yourVaults}</p>
                {soloVaults.map(progressCard)}
              </section>
            )}

            {sharedVaults.length > 0 && (
              <section className="flex flex-col gap-2.5">
                <p className="text-sm font-medium text-neutral-700">{t.home.sharedVaults}</p>
                {sharedVaults.map(sharedCard)}
              </section>
            )}

            {keyholderVaults.length > 0 && (
              <section className="flex flex-col gap-2.5">
                <p className="text-sm font-medium text-neutral-700">{t.home.canUnlockTitle}</p>
                {keyholderVaults.map(keyholderCard)}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
