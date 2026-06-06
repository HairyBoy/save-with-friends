"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { TopBar, topBarAvatarClass } from "@/components/TopBar";
import { useSavings } from "@/hooks/useVaults";
import type { Vault } from "@/lib/vaults";

// My Vaults (home). Two stats + agent update, then vaults grouped into solo
// ("Your Vaults") and "Shared Vaults" (pending invites flagged).
export default function MyVaultsScreen() {
  const { t, lang } = useLanguage();
  const { vaults, summary, isLoading } = useSavings();

  const numLocale = lang === "es" ? "es-CO" : "en-US";
  const fmt = (n: number) => n.toLocaleString(numLocale, { maximumFractionDigits: 2 });

  const soloVaults = vaults.filter((v) => !v.shared);
  const sharedVaults = vaults.filter((v) => v.shared);

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
            {v.shared && (
              <p className="text-xs text-neutral-500">
                👥 {v.members?.length ?? 0} {t.home.members}
              </p>
            )}
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

  // A pending invite: amber-flagged, shows who invited you.
  function pendingCard(v: Vault) {
    return (
      <Link
        key={v.id}
        href={`/vault/${v.id}`}
        className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm backdrop-blur-md"
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/70 text-lg">
          {v.icon}
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium">{v.name}</p>
          <p className="text-xs text-neutral-500">
            {t.home.invitedBy} {v.ownerName}
          </p>
        </div>
        <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-xs font-medium text-amber-800">
          {t.home.pending}
        </span>
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

        <section className="rounded-2xl border border-primary-light/60 bg-primary-tint/70 p-4 shadow-sm backdrop-blur-md">
          <p className="text-sm font-semibold text-primary-dark">{t.home.agentUpdate}</p>
          <p className="mt-1 text-sm text-neutral-600">{t.home.agentUpdateBody}</p>
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
                {sharedVaults.map((v) =>
                  v.inviteStatus === "pending" ? pendingCard(v) : progressCard(v),
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
