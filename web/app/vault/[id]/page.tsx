"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { TopBar, topBarActionClass } from "@/components/TopBar";
import { useVault } from "@/hooks/useVaults";
import { acceptInvite, declineInvite } from "@/lib/vaults";

// Vault detail (full-screen push, no tab bar). Shared vaults show their members
// and split mode; a pending invite shows the details + Accept / Decline.
export default function VaultDetailScreen() {
  const { t, lang } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { vault, isLoading } = useVault(id);

  const numLocale = lang === "es" ? "es-CO" : "en-US";
  const fmt = (n: number) => n.toLocaleString(numLocale, { maximumFractionDigits: 2 });
  const pct = vault && vault.goal > 0 ? Math.min(100, Math.round((vault.saved / vault.goal) * 100)) : 0;
  const isPendingInvite = vault?.shared && vault.inviteStatus === "pending";

  async function accept() {
    await acceptInvite(id);
    router.push("/");
  }

  async function decline() {
    await declineInvite(id);
    router.push("/");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        title={`${t.vaultDetail.titlePrefix}${id}`}
        left={
          <Link href="/" aria-label={t.vaultDetail.back} className={topBarActionClass}>
            ←
          </Link>
        }
      />

      <div className="flex flex-1 flex-col gap-5 px-5 py-6">
        {/* Fill progress — the "vault filling up" centerpiece. */}
        <section className="rounded-2xl border border-white/60 bg-white/60 p-5 text-center shadow-sm backdrop-blur-md">
          <p className="text-sm font-medium text-neutral-500">
            {vault?.name ?? (isLoading ? "…" : t.vaultDetail.namePlaceholder)}
          </p>
          <p className="mt-2 text-3xl font-semibold text-primary-dark">${fmt(vault?.saved ?? 0)}</p>
          <p className="mt-1 text-sm text-neutral-400">/ ${fmt(vault?.goal ?? 0)}</p>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-primary-tint">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs font-medium text-neutral-500">{pct}%</p>
        </section>

        {/* Members + split (shared only) */}
        {vault?.shared && vault.members && (
          <section className="rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{t.vaultDetail.members}</p>
              <p className="text-xs font-medium text-neutral-500">
                {vault.splitMode === "equal" ? t.create.splitEqual : t.create.splitContribution}
              </p>
            </div>
            <ul className="mt-2 flex flex-col gap-1.5">
              {vault.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-neutral-700">
                    {m.name}
                    {!m.accepted && (
                      <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {t.home.pending}
                      </span>
                    )}
                  </span>
                  <span className="font-medium text-neutral-600">${fmt(m.contributed)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
          <p className="text-sm font-semibold">{t.vaultDetail.unlocksWhen}</p>
          <p className="mt-1 text-sm text-neutral-600">{t.vaultDetail.goalReached}</p>
          <p className="text-sm text-neutral-600">{t.vaultDetail.timerEnds}</p>
          <p className="text-sm text-neutral-600">{t.vaultDetail.friendApproves}</p>
        </section>

        <section className="rounded-2xl border border-primary-light/60 bg-primary-tint/70 p-4 shadow-sm backdrop-blur-md">
          <p className="text-sm font-semibold text-primary-dark">{t.vaultDetail.yieldEarned}</p>
          <p className="mt-1 text-sm text-neutral-600">${fmt(vault?.yieldEarned ?? 0)}</p>
        </section>

        <div className="mt-auto flex flex-col gap-2.5">
          {isPendingInvite ? (
            <>
              <button
                type="button"
                onClick={accept}
                className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-center text-sm font-medium text-white shadow-lg shadow-emerald-600/20"
              >
                {t.vaultDetail.accept}
              </button>
              <button
                type="button"
                onClick={decline}
                className="rounded-2xl border border-white/60 bg-white/60 p-4 text-center text-sm font-medium shadow-sm backdrop-blur-md"
              >
                {t.vaultDetail.decline}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-center text-sm font-medium text-white shadow-lg shadow-emerald-600/20"
              >
                {t.vaultDetail.deposit}
              </button>
              <button
                type="button"
                className="rounded-2xl border border-white/60 bg-white/60 p-4 text-center text-sm font-medium shadow-sm backdrop-blur-md"
              >
                {t.vaultDetail.requestEarlyExit}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
