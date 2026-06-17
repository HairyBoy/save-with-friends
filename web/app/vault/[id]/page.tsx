"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { TopBar, topBarActionClass } from "@/components/TopBar";
import { useVault, useWalletBalance } from "@/hooks/useVaults";
import {
  acceptInvite,
  declineInvite,
  depositToVault,
  devApproveAsKeyholder,
  devFastForward,
  IS_DEV_CHAIN,
  IS_TEST_ENV,
  vaultPayout,
  withdrawVault,
} from "@/lib/vaults";

const primaryBtn =
  "rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-center text-sm font-medium text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50";
const secondaryBtn =
  "rounded-2xl border border-white/60 bg-white/60 p-4 text-center text-sm font-medium shadow-sm backdrop-blur-md disabled:opacity-50";

// Vault detail (full-screen push, no tab bar). Shared vaults show their members
// and split mode; a pending invite shows the details + Accept / Decline. For a
// solo (on-chain) vault: Deposit, Withdraw (once unlocked), and a dev-only
// time-travel panel to fast-forward the chain past the deadline.
export default function VaultDetailScreen() {
  const { t, lang } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { vault, unlocked, chainNow, keyholders, isLoading, reload } = useVault(id);
  const { balance, reload: reloadWallet } = useWalletBalance();

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
      ? keyholders.map((k) => k.name).join(", ")
      : t.vaultDetail.aFriend;
  const isPendingInvite = vault?.shared && vault.inviteStatus === "pending";
  const isSolo = vault != null && !vault.shared;

  const depositNum = Number(amount);
  const overBalance = balance !== null && depositNum > balance;
  const depositValid = amount.trim() !== "" && depositNum > 0 && !overBalance;

  async function accept() {
    await acceptInvite(id);
    router.push("/");
  }

  async function decline() {
    await declineInvite(id);
    router.push("/");
  }

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

  function requestUnlock() {
    setError(null);
    setNote(keyholders.length > 0 ? t.vaultDetail.unlockAsk : t.vaultDetail.noKeyholders);
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

        {/* Members + split (shared only): who put in what, and what they receive */}
        {vault?.shared && vault.members && (
          <section className="rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
            <p className="text-sm font-semibold">{t.vaultDetail.members}</p>
            {/* Column headers */}
            <div className="mt-3 grid grid-cols-[1fr_auto_auto] items-center gap-x-4 text-xs font-medium text-neutral-400">
              <span />
              <span className="w-20 text-right">{t.vaultDetail.contributions}</span>
              <span className="w-20 text-right">{t.vaultDetail.receives}</span>
            </div>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {vault.members.map((m) => (
                <li
                  key={m.id}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 text-sm"
                >
                  <span className="flex items-center gap-1.5 text-neutral-700">
                    {m.name}
                    {!m.accepted && (
                      <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {t.home.pending}
                      </span>
                    )}
                  </span>
                  <span className="w-20 text-right text-neutral-500">${fmt(m.contributed)}</span>
                  <span className="w-20 text-right font-medium text-primary-dark">
                    ${fmt(vaultPayout(vault, m.id))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

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
                    {t.vaultDetail.approveAs} {k.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          {isPendingInvite ? (
            <>
              <button type="button" onClick={accept} className={primaryBtn}>
                {t.vaultDetail.accept}
              </button>
              <button type="button" onClick={decline} className={secondaryBtn}>
                {t.vaultDetail.decline}
              </button>
            </>
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
              <div className="flex items-baseline justify-between gap-2">
                <span className={`text-xs ${overBalance ? "text-red-500" : "text-neutral-400"}`}>
                  {overBalance ? t.create.insufficientFunds : ""}
                </span>
                {balance !== null && (
                  <span className={`shrink-0 text-xs ${overBalance ? "text-red-500" : "text-neutral-400"}`}>
                    {t.create.available}: ${fmt(balance)}
                  </span>
                )}
              </div>
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
