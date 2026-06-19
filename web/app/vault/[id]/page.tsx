"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { useWallet } from "@/components/WalletProvider";
import { BalanceNotice } from "@/components/BalanceNotice";
import { TopBar, topBarActionClass } from "@/components/TopBar";
import { useVault, useWalletBalance } from "@/hooks/useVaults";
import {
  approveUnlock,
  depositToVault,
  devApproveAsKeyholder,
  devFastForward,
  IS_DEV_CHAIN,
  IS_TEST_ENV,
  withdrawVault,
} from "@/lib/vaults";

const primaryBtn =
  "rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-center text-sm font-medium text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50";
const secondaryBtn =
  "rounded-2xl border border-white/60 bg-white/60 p-4 text-center text-sm font-medium shadow-sm backdrop-blur-md disabled:opacity-50";

// Solo vault detail (full-screen push, no tab bar). Deposit, Withdraw (once
// unlocked), a keyholder's "Approve unlock", and a dev-only time-travel panel.
// (Group vaults have their own screen at /shared/[id].)
export default function VaultDetailScreen() {
  const { t, lang } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { vault, unlocked, chainNow, keyholders, isLoading, reload } = useVault(id);
  const { balance, reload: reloadWallet } = useWalletBalance();
  const { address } = useWallet();

  const [depositing, setDepositing] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const numLocale = lang === "es" ? "es-CO" : "en-US";
  const fmt = (n: number) => n.toLocaleString(numLocale, { maximumFractionDigits: 2 });
  const fmtDateTime = (ms: number) =>
    new Date(ms).toLocaleString(numLocale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  // The exact unlock-by moment (the timer). Solo vaults carry a precise unix
  // timestamp; the shared stub only has a date, so fall back to end-of-day.
  const unlockMs =
    vault?.deadlineUnix != null
      ? vault.deadlineUnix * 1000
      : vault?.deadline
        ? new Date(`${vault.deadline}T23:59:59`).getTime()
        : null;
  const pct = vault && vault.goal > 0 ? Math.min(100, Math.round((vault.saved / vault.goal) * 100)) : 0;
  // The friend(s) who hold a key to unlock early (on-chain keyholders, resolved
  // to names); falls back to a generic label when none were picked.
  const friendLabel =
    keyholders.length > 0
      ? keyholders.map((k) => k.name ?? t.vaultDetail.aFriend).join(", ")
      : t.vaultDetail.aFriend;
  const isSolo = vault != null;
  // Who's viewing this solo vault? A keyholder (a friend who can approve), the
  // owner (deposits/withdraws), or a stranger with the link. The contract bars the
  // owner from being a keyholder, so the two never overlap.
  const me = address?.toLowerCase();
  const isKeyholder = !!me && keyholders.some((k) => k.address.toLowerCase() === me);
  const isOwner = !!me && vault?.ownerAddress?.toLowerCase() === me;
  const isKeyholderView = isSolo && isKeyholder && !isOwner;
  const isViewerOnly = isSolo && !!me && !isOwner && !isKeyholder;

  const depositNum = Number(amount);
  const overBalance = balance !== null && depositNum > balance;
  const depositValid = amount.trim() !== "" && depositNum > 0 && !overBalance;

  async function confirmDeposit() {
    if (!depositValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await depositToVault(id, depositNum);
      setDepositing(false);
      setAmount("");
      reloadWallet();
      reload();
    } catch {
      setError(t.vaultDetail.depositError);
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await withdrawVault(id);
      router.push("/"); // vault is now closed; back to the list
    } catch {
      setError(t.vaultDetail.withdrawError);
      setBusy(false);
    }
  }

  async function skipTime(days: number) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await devFastForward(days);
      reload(); // re-checks unlocked
    } finally {
      setBusy(false);
    }
  }

  function startDeposit() {
    setNote(null);
    setError(null);
    setDepositing(true);
  }

  async function requestUnlock() {
    setError(null);
    if (keyholders.length === 0) {
      setNote(t.vaultDetail.noKeyholders);
      return;
    }
    // The owner shares this vault's link with a keyholder out-of-band; the keyholder
    // opens it and approves from their own wallet. Copy the link to make that easy.
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      /* clipboard may be unavailable; the note still explains the flow */
    }
    setNote(t.vaultDetail.unlockAsk);
  }

  // A keyholder approves the early unlock from their OWN connected wallet.
  async function approveUnlockSelf() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await approveUnlock(id);
      reload(); // approvals >= threshold → unlocked
    } catch {
      setError(t.vaultDetail.approveUnlockError);
    } finally {
      setBusy(false);
    }
  }

  // DEV: approve the early unlock as one of the keyholders (their Anvil account).
  async function approveAs(keyholder: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await devApproveAsKeyholder(id, keyholder);
      reload(); // approvals >= threshold → unlocked
    } finally {
      setBusy(false);
    }
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

        <section className="rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
          <p className="text-sm font-semibold">{t.vaultDetail.unlockConditions}</p>
          <ul className="mt-3 flex flex-col gap-2.5 text-sm text-neutral-700">
            <li className="flex items-center gap-2.5">
              <span className="text-base leading-none">🎯</span>
              <span>{t.vaultDetail.goalReached}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-base leading-none">⏳</span>
              <span className="font-medium">{unlockMs != null ? fmtDateTime(unlockMs) : "—"}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-base leading-none">🤝</span>
              <span>
                {friendLabel} {t.vaultDetail.unlocks}
              </span>
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-primary-light/60 bg-primary-tint/70 p-4 shadow-sm backdrop-blur-md">
          <p className="text-sm font-semibold text-primary-dark">{t.vaultDetail.yieldEarned}</p>
          <p className="mt-1 text-sm text-neutral-600">${fmt(vault?.yieldEarned ?? 0)}</p>
        </section>

        <div className="mt-auto flex flex-col gap-2.5">
          {/* DEV-ONLY: fast-forward the chain so a timer vault crosses its deadline. */}
          {IS_DEV_CHAIN && isSolo && (
            <section className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-semibold text-neutral-500">{t.vaultDetail.devTimeTravel}</p>
                <p className="text-xs text-neutral-500">
                  {t.vaultDetail.devClock}: {chainNow ? fmtDateTime(chainNow * 1000) : "…"}
                </p>
              </div>
              <div className="mt-2 flex gap-2">
                {[
                  { days: 7, label: t.vaultDetail.devSkipWeek },
                  { days: 30, label: t.vaultDetail.devSkipMonth },
                  { days: 365, label: t.vaultDetail.devSkipYear },
                ].map((s) => (
                  <button
                    key={s.days}
                    type="button"
                    onClick={() => skipTime(s.days)}
                    disabled={busy}
                    className="flex-1 rounded-xl border border-neutral-200 bg-white/70 px-2 py-2 text-xs font-medium text-neutral-600 disabled:opacity-50"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* DEV/TEST: approve the early unlock as a keyholder (signs client-side
              locally, via /api/dev/approve-as on testnet). Hidden once unlocked. */}
          {IS_TEST_ENV && isSolo && !unlocked && keyholders.length > 0 && (
            <section className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 p-3">
              <p className="text-xs font-semibold text-neutral-500">{t.vaultDetail.devApproveAs}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {keyholders.map((k) => (
                  <button
                    key={k.address}
                    type="button"
                    onClick={() => approveAs(k.address)}
                    disabled={busy}
                    className="flex-1 rounded-xl border border-neutral-200 bg-white/70 px-2 py-2 text-xs font-medium text-neutral-600 disabled:opacity-50"
                  >
                    {t.vaultDetail.approveAs} {k.name ?? t.vaultDetail.aFriend}
                  </button>
                ))}
              </div>
            </section>
          )}

          {isKeyholderView ? (
            unlocked ? (
              <p className="rounded-2xl border border-primary-light/60 bg-primary-tint/70 px-4 py-3 text-center text-sm text-primary-dark">
                {t.vaultDetail.approveUnlockDone}
              </p>
            ) : (
              <>
                <p className="rounded-2xl border border-white/60 bg-white/60 px-4 py-3 text-center text-sm text-neutral-600 shadow-sm backdrop-blur-md">
                  {t.vaultDetail.keyholderNote}
                </p>
                <button
                  type="button"
                  onClick={approveUnlockSelf}
                  disabled={busy}
                  className={primaryBtn}
                >
                  {busy ? t.vaultDetail.processing : t.vaultDetail.approveUnlock}
                </button>
              </>
            )
          ) : isViewerOnly ? (
            <p className="rounded-2xl border border-white/60 bg-white/60 px-4 py-3 text-center text-sm text-neutral-500 shadow-sm backdrop-blur-md">
              {t.vaultDetail.viewerNote}
            </p>
          ) : depositing ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
              <p className="text-sm font-semibold">{t.vaultDetail.depositTitle}</p>
              <div className="flex items-center gap-2 rounded-2xl border border-white/60 bg-white/60 px-4 py-3">
                <span className="text-neutral-400">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
                />
                <span className="text-xs font-semibold text-neutral-400">{t.create.goalCurrency}</span>
              </div>
              <BalanceNotice over={overBalance} available={balance} />
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setDepositing(false);
                    setAmount("");
                    setError(null);
                  }}
                  className={`flex-1 ${secondaryBtn}`}
                >
                  {t.vaultDetail.cancel}
                </button>
                <button
                  type="button"
                  onClick={confirmDeposit}
                  disabled={!depositValid || busy}
                  className={`flex-1 ${primaryBtn}`}
                >
                  {busy ? t.vaultDetail.processing : t.vaultDetail.add}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Deposit is always the top action; the bottom one switches to
                  Withdraw once the vault's unlock conditions are met. */}
              <button type="button" onClick={startDeposit} className={primaryBtn}>
                {t.vaultDetail.deposit}
              </button>
              {unlocked ? (
                <button type="button" onClick={withdraw} disabled={busy} className={secondaryBtn}>
                  {busy ? t.vaultDetail.processing : t.vaultDetail.withdraw}
                </button>
              ) : (
                <button type="button" onClick={requestUnlock} className={secondaryBtn}>
                  {t.vaultDetail.requestUnlock}
                </button>
              )}
            </>
          )}

          {note && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-center text-sm text-amber-700">
              {note}
            </p>
          )}
          {error && (
            <p className="rounded-2xl border border-red-200 bg-red-50/70 px-4 py-3 text-center text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
