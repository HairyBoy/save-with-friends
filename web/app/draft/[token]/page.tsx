"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@/components/WalletProvider";
import { useDraft, useMyName, useWalletBalance } from "@/hooks/useVaults";
import { joinDraft, launchDraft, removeDraftMember } from "@/lib/sharedVaults";

// Shared-vault DRAFT screen (full-screen, no tab bar). Role-aware:
//  • Owner → assemble the roster (invite link, remove), set a starting deposit, and
//    "Create vault" (launch on-chain with the fixed roster).
//  • Friend → confirm their name and Join the roster.
// Once launched, both views redirect to the live /shared/[id]. Membership is frozen
// at launch, so a leaked link can't add anyone after.
export default function DraftScreen() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { address } = useWallet();
  const { draft, isLoading, reload } = useDraft(token);
  const { name: myName } = useMyName();
  const { balance } = useWalletBalance();

  const [joinName, setJoinName] = useState<string | null>(null);
  const [deposit, setDeposit] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const me = address?.toLowerCase();
  const isOwner = !!me && draft != null && draft.owner.toLowerCase() === me;
  const isMember = !!me && draft != null && draft.members.some((m) => m.address.toLowerCase() === me);
  const payoutLabel =
    draft?.payoutMode === "owner-takes-all" ? "Group gift — goes to the owner" : "Everyone gets their own back";

  const card = "w-full rounded-2xl border border-white/60 bg-white/60 p-5 shadow-sm backdrop-blur-md";
  const primaryBtn =
    "w-full rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-center text-sm font-medium text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50";

  async function invite() {
    setNote(null);
    const url = `${window.location.origin}/draft/${token}`;
    try {
      if (navigator.share) await navigator.share({ title: draft?.name ?? "Save with Friends", text: "Join my savings vault 🐷", url });
      else {
        await navigator.clipboard.writeText(url);
        setNote("Invite link copied — share it!");
      }
    } catch {
      /* share canceled */
    }
  }

  async function join() {
    const nameValue = (joinName ?? myName ?? "").trim();
    if (!nameValue || busy) return;
    setBusy(true);
    setError(null);
    try {
      await joinDraft(token, nameValue);
      reload();
    } catch {
      setError("Couldn't join. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const id = await launchDraft(token, Number(deposit) || 0);
      router.push(`/shared/${id}`);
    } catch {
      setError("Couldn't create the vault. Please try again.");
      setBusy(false);
    }
  }

  if (isLoading) {
    return <div className="grid min-h-dvh place-items-center text-neutral-400">…</div>;
  }
  if (!draft) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center text-sm text-neutral-600">
        This vault draft doesn&apos;t exist.
      </div>
    );
  }
  if (draft.launchedVaultId) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-3xl">{draft.icon}</p>
        <p className="text-sm text-neutral-600">This vault has already started.</p>
        <Link href={`/shared/${draft.launchedVaultId}`} className={primaryBtn}>
          Go to the vault
        </Link>
      </div>
    );
  }

  const nameValue = joinName ?? myName ?? "";

  return (
    <div className="flex min-h-dvh flex-col gap-5 px-5 py-8">
      <div className="text-center">
        <p className="text-4xl">{draft.icon}</p>
        <h1 className="mt-2 text-xl font-bold">{draft.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Goal ${draft.goal} · {payoutLabel}
        </p>
      </div>

      {/* Roster */}
      <section className={card}>
        <p className="text-sm font-semibold">Who&apos;s in ({draft.members.length})</p>
        <ul className="mt-3 flex flex-col gap-2">
          {draft.members.map((m) => {
            const isOwnerRow = m.address.toLowerCase() === draft.owner.toLowerCase();
            return (
              <li key={m.address} className="flex items-center gap-3 text-sm">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-tint text-base">👤</span>
                <span className="flex-1">
                  {m.name || "A friend"}
                  {isOwnerRow && <span className="ml-1 text-xs text-neutral-400">· owner</span>}
                </span>
                {isOwner && !isOwnerRow && (
                  <button
                    type="button"
                    onClick={async () => {
                      await removeDraftMember(token, m.address);
                      reload();
                    }}
                    aria-label="Remove"
                    className="grid h-7 w-7 place-items-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-500"
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {note && <p className="text-center text-xs text-primary-dark">{note}</p>}
      {error && <p className="text-center text-xs text-red-500">{error}</p>}

      {isOwner ? (
        <div className="mt-auto flex flex-col gap-3">
          <button type="button" onClick={invite} className="w-full rounded-2xl border border-white/60 bg-white/60 p-3 text-sm font-medium shadow-sm backdrop-blur-md">
            🔗 Invite friends
          </button>
          <div className={card}>
            <label htmlFor="d-deposit" className="text-sm font-medium text-neutral-700">
              Your starting amount
            </label>
            <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-white/60 bg-white/60 px-4 py-3">
              <span className="text-neutral-400">$</span>
              <input
                id="d-deposit"
                type="text"
                inputMode="decimal"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                placeholder="0"
                className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
              />
              <span className="text-xs font-semibold text-neutral-400">USD</span>
            </div>
            {balance !== null && (
              <p className="mt-1 text-xs text-neutral-400">Available: ${balance.toLocaleString()}</p>
            )}
          </div>
          <button type="button" onClick={create} disabled={busy} className={primaryBtn}>
            {busy ? "Creating…" : "Create vault"}
          </button>
          <p className="text-center text-xs text-neutral-500">
            Once you create it, the members are locked in and no one else can join.
          </p>
        </div>
      ) : isMember ? (
        <p className="mt-auto rounded-2xl border border-primary-light/60 bg-primary-tint/70 p-4 text-center text-sm text-primary-dark">
          You&apos;re in! Waiting for {draft.ownerName ?? "the owner"} to start it.
        </p>
      ) : (
        <div className="mt-auto flex flex-col gap-3">
          <p className="text-center text-sm text-neutral-600">
            {draft.ownerName ?? "A friend"} invited you to save together.
          </p>
          {!address ? (
            <p className="text-center text-sm text-amber-700">Open this in MiniPay to join.</p>
          ) : (
            <>
              <input
                type="text"
                maxLength={40}
                value={nameValue}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm outline-none placeholder:text-neutral-400 focus:border-primary/50"
              />
              <button type="button" onClick={join} disabled={!nameValue.trim() || busy} className={primaryBtn}>
                {busy ? "Joining…" : "Join"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
