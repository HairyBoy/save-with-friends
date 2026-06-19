"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { useWallet } from "@/components/WalletProvider";
import { TopBar, topBarActionClass } from "@/components/TopBar";
import { useSharedVault, useWalletBalance } from "@/hooks/useVaults";
import { approveSharedUnlock, contributeToShared, sharedPayout, withdrawFromShared } from "@/lib/sharedVaults";
import { BalanceNotice } from "@/components/BalanceNotice";

// Shared (group) vault detail (full-screen). Members contribute their own funds;
// unlock on goal / deadline / strict-majority approval; withdraw by payout mode
// (each their own, or the owner claims the pot). Separate from the solo /vault/[id]
// (different contract). No 0x addresses shown — members appear by name.
export default function SharedVaultScreen() {
  const { t, lang } = useLanguage();
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { address } = useWallet();
  const { vault, unlocked, isLoading, reload } = useSharedVault(token);
  const { balance, reload: reloadWallet } = useWalletBalance();

  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numLocale = lang === "es" ? "es-CO" : "en-US";
  const fmt = (n: number) => n.toLocaleString(numLocale, { maximumFractionDigits: 2 });
  const fmtDate = (unix: number) =>
    new Date(unix * 1000).toLocaleDateString(numLocale, { day: "numeric", month: "short", year: "numeric" });

  const me = address?.toLowerCase();
  const isMember = !!me && vault?.members?.some((m) => m.address.toLowerCase() === me);
  const isOwner = !!me && vault?.ownerAddress.toLowerCase() === me;
  const myContribution = vault?.members?.find((m) => m.address.toLowerCase() === me)?.contributed ?? 0;
  const pct = vault && vault.goal > 0 ? Math.min(100, Math.round((vault.saved / vault.goal) * 100)) : 0;
  const majorityNeeded = vault ? Math.floor(vault.memberCount / 2) + 1 : 0;

  const amountNum = Number(amount);
  const overBalance = balance !== null && amountNum > balance;
  const canContribute = amount.trim() !== "" && amountNum > 0 && !overBalance;

  const primaryBtn =
    "rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-center text-sm font-medium text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50";
  const secondaryBtn =
    "rounded-2xl border border-white/60 bg-white/60 p-4 text-center text-sm font-medium shadow-sm backdrop-blur-md disabled:opacity-50";

  async function run(fn: () => Promise<void>, after: "reload" | "home", failMsg: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (after === "home") router.push("/");
      else {
        reloadWallet();
        reload();
      }
    } catch {
      setError(failMsg);
      setBusy(false);
    }
  }

  if (isLoading) return <div className="grid min-h-dvh place-items-center text-neutral-400">…</div>;
  if (!vault) {
    return <div className="grid min-h-dvh place-items-center px-6 text-center text-sm text-neutral-600">{t.shared.vaultNotFound}</div>;
  }

  const payoutLabel = vault.payoutMode === "owner-takes-all" ? t.shared.payoutOwnerGift : t.shared.payoutByContribution;

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        title={`${vault.icon} ${vault.name}`}
        left={
          <Link href="/" aria-label={t.shared.back} className={topBarActionClass}>
            ←
          </Link>
        }
      />

      <div className="flex flex-1 flex-col gap-5 px-5 py-6">
        {/* Progress */}
        <section className="rounded-2xl border border-white/60 bg-white/60 p-5 text-center shadow-sm backdrop-blur-md">
          <p className="text-3xl font-semibold text-primary-dark">${fmt(vault.saved)}</p>
          <p className="mt-1 text-sm text-neutral-400">/ ${fmt(vault.goal)}</p>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-primary-tint">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs font-medium text-neutral-500">{payoutLabel}</p>
        </section>

        {/* Accrued Aave yield (earning vaults only). */}
        {vault.earning && (
          <section className="rounded-2xl border border-primary-light/60 bg-primary-tint/70 p-4 shadow-sm backdrop-blur-md">
            <p className="text-sm font-semibold text-primary-dark">📈 {t.vaultDetail.yieldEarned}</p>
            <p className="mt-1 text-sm text-neutral-600">${fmt(vault.yieldEarned)}</p>
          </section>
        )}

        {/* Members */}
        <section className="rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 text-xs font-medium text-neutral-400">
            <span>{t.shared.members}</span>
            <span className="w-20 text-right">{t.shared.putIn}</span>
            <span className="w-20 text-right">{t.shared.receives}</span>
          </div>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {vault.members?.map((m) => (
              <li key={m.address} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 text-sm">
                <span className="text-neutral-700">
                  {m.name || t.shared.aFriend}
                  {m.isOwner && <span className="ml-1 text-xs text-neutral-400">· {t.shared.ownerTag}</span>}
                </span>
                <span className="w-20 text-right text-neutral-500">${fmt(m.contributed)}</span>
                <span className="w-20 text-right font-medium text-primary-dark">${fmt(sharedPayout(vault, m.address))}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Unlock conditions */}
        <section className="rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
          <p className="text-sm font-semibold">{t.shared.unlockConditions}</p>
          <ul className="mt-3 flex flex-col gap-2.5 text-sm text-neutral-700">
            <li className="flex items-center gap-2.5"><span>🎯</span><span>{t.shared.goalLinePrefix} ${fmt(vault.goal)} {t.shared.goalLineSuffix}</span></li>
            <li className="flex items-center gap-2.5"><span>⏳</span><span className="font-medium">{fmtDate(vault.deadlineUnix)}</span></li>
            <li className="flex items-center gap-2.5">
              <span>🤝</span>
              <span>{vault.approvals} {t.shared.approvalsOf} {majorityNeeded} {t.shared.approvalsSuffix}</span>
            </li>
          </ul>
        </section>

        {/* Actions */}
        <div className="mt-auto flex flex-col gap-2.5">
          {error && (
            <p className="rounded-2xl border border-red-200 bg-red-50/70 px-4 py-3 text-center text-sm text-red-600">{error}</p>
          )}

          {!isMember ? (
            <p className={secondaryBtn}>{t.shared.viewerNote}</p>
          ) : unlocked ? (
            vault.payoutMode === "owner-takes-all" ? (
              isOwner ? (
                <button type="button" onClick={() => run(() => withdrawFromShared(token), "home", t.shared.withdrawError)} disabled={busy} className={primaryBtn}>
                  {busy ? t.shared.working : t.shared.claimPot}
                </button>
              ) : (
                <p className={secondaryBtn}>{t.shared.ownerGiftNote}</p>
              )
            ) : myContribution > 0 ? (
              <button type="button" onClick={() => run(() => withdrawFromShared(token), "reload", t.shared.withdrawError)} disabled={busy} className={primaryBtn}>
                {busy ? t.shared.working : `${t.shared.withdrawMyPrefix} $${fmt(myContribution)}`}
              </button>
            ) : (
              <p className={secondaryBtn}>{t.shared.nothingToWithdraw}</p>
            )
          ) : (
            <>
              {/* Contribute */}
              <div className="flex flex-col gap-2 rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
                <p className="text-sm font-semibold">{t.shared.addContribution}</p>
                <div className="flex items-center gap-2 rounded-2xl border border-white/60 bg-white/60 px-4 py-3">
                  <span className="text-neutral-400">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
                  />
                  <span className="text-xs font-semibold text-neutral-400">{t.create.goalCurrency}</span>
                </div>
                <BalanceNotice
                  over={overBalance}
                  available={balance}
                  hint={`${t.shared.youvePutIn} $${fmt(myContribution)}`}
                />
                <button
                  type="button"
                  onClick={() => run(() => contributeToShared(token, amountNum).then(() => setAmount("")), "reload", t.shared.contributeError)}
                  disabled={!canContribute || busy}
                  className={primaryBtn}
                >
                  {busy ? t.shared.working : t.shared.contribute}
                </button>
              </div>
              {/* Majority early-unlock */}
              <button type="button" onClick={() => run(() => approveSharedUnlock(token), "reload", t.shared.approveError)} disabled={busy} className={secondaryBtn}>
                {busy ? t.shared.working : t.shared.approveUnlock}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
