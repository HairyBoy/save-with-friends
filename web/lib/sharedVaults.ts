// Data-access layer for SHARED (group) vaults — the human-USD seam the screens read.
// Mirrors lib/vaults.ts (solo): on-chain reads/writes via lib/onchainSharedVaults,
// names from the friends/users layer, and the off-chain DRAFT assembly (/api/drafts).
// Shared vaults live on their own contract + route (/shared/[id]); names come from the
// draft they were launched from.

import { formatUnits, parseUnits, zeroAddress, type Address } from "viem";
import { activeChain, getActiveAccount, TOKEN_DECIMALS } from "@/lib/chains";
import { readChainNow } from "@/lib/onchainVaults";
import {
  approveSharedEarlyExit,
  createSharedVault,
  depositShared,
  PAYOUT_OWNER_TAKES_ALL,
  readContribution,
  readMemberVaultIds,
  readSharedMembers,
  readSharedUnlocked,
  readSharedVault,
  withdrawShared,
  type OnchainSharedVault,
} from "@/lib/onchainSharedVaults";
import { resolveNames } from "@/lib/friends";

export type PayoutMode = "by-contribution" | "owner-takes-all";

export type SharedMember = {
  address: string;
  name: string | null; // resolved display name; null → "a friend" in the UI
  contributed: number; // USD
  isOwner: boolean;
};

export type SharedVault = {
  id: string; // raw on-chain id
  name: string;
  icon: string;
  goal: number;
  saved: number;
  currency: "USD";
  deadlineUnix: number;
  ownerAddress: Address;
  payoutMode: PayoutMode;
  memberCount: number;
  approvals: number;
  members?: SharedMember[]; // populated by getSharedVault (detail); omitted in the list
};

export type Draft = {
  id: string;
  owner: Address;
  ownerName: string | null;
  name: string;
  icon: string;
  goal: string; // human USD
  deadlineDays: number;
  payoutMode: PayoutMode;
  launchedVaultId: string | null;
  members: { address: string; name: string | null }[];
};

const CHAIN_ID = activeChain.id;

function currentUser(): Address {
  return getActiveAccount() ?? zeroAddress;
}
const toUsd = (wei: bigint) => Number(formatUnits(wei, TOKEN_DECIMALS));
const payoutModeOf = (v: OnchainSharedVault): PayoutMode =>
  v.payout === PAYOUT_OWNER_TAKES_ALL ? "owner-takes-all" : "by-contribution";

// --- shared-vault names (from the launched draft) ---------------------------

async function fetchSharedMeta(ids: string[]): Promise<Map<string, { name: string; icon: string }>> {
  const map = new Map<string, { name: string; icon: string }>();
  if (ids.length === 0) return map;
  try {
    const res = await fetch(`/api/drafts/launched?ids=${ids.join(",")}`);
    if (res.ok) {
      const rows = (await res.json()) as { id: string; name: string; icon: string }[];
      for (const r of rows) map.set(r.id, { name: r.name, icon: r.icon });
    }
  } catch {
    /* best-effort — falls back to a default name */
  }
  return map;
}

function mapLight(id: bigint, v: OnchainSharedVault, meta?: { name: string; icon: string }): SharedVault {
  return {
    id: id.toString(),
    name: meta?.name ?? "Shared vault",
    icon: meta?.icon ?? "🏖️",
    goal: toUsd(v.goal),
    saved: toUsd(v.saved),
    currency: "USD",
    deadlineUnix: Number(v.deadline),
    ownerAddress: v.owner,
    payoutMode: payoutModeOf(v),
    memberCount: v.memberCount,
    approvals: v.approvals,
  };
}

// --- reads ------------------------------------------------------------------

/** Every (non-closed) shared vault the current user is a member of. Light (no
 *  per-member detail) — for the home list. */
export async function getSharedVaults(): Promise<SharedVault[]> {
  const me = currentUser();
  if (me === zeroAddress) return [];
  const ids = await readMemberVaultIds(me);
  if (ids.length === 0) return [];
  const meta = await fetchSharedMeta(ids.map((i) => i.toString()));
  const out = await Promise.all(
    ids.map(async (id) => {
      const v = await readSharedVault(id);
      return v.closed ? null : mapLight(id, v, meta.get(id.toString()));
    }),
  );
  return out.filter((x): x is SharedVault => x !== null).reverse();
}

/** One shared vault with full member + contribution detail — for the detail screen. */
export async function getSharedVault(id: string): Promise<SharedVault | null> {
  const idB = BigInt(id);
  const v = await readSharedVault(idB);
  if (v.owner === zeroAddress) return null;
  const memberAddrs = await readSharedMembers(idB);
  const [names, contribs, meta] = await Promise.all([
    resolveNames(memberAddrs),
    Promise.all(memberAddrs.map((a) => readContribution(idB, a))),
    fetchSharedMeta([id]),
  ]);
  const ownerLc = v.owner.toLowerCase();
  const members: SharedMember[] = memberAddrs.map((a, i) => ({
    address: a,
    name: names[a.toLowerCase()] ?? null,
    contributed: toUsd(contribs[i]),
    isOwner: a.toLowerCase() === ownerLc,
  }));
  return { ...mapLight(idB, v, meta.get(id)), members };
}

export async function getSharedUnlocked(id: string): Promise<boolean> {
  return readSharedUnlocked(BigInt(id));
}

/** What `memberAddress` receives when the vault unlocks (USD): their own contribution
 *  (by-contribution) or, for owner-takes-all, the whole pot if they're the owner. */
export function sharedPayout(v: SharedVault, memberAddress: string): number {
  const m = v.members?.find((x) => x.address.toLowerCase() === memberAddress.toLowerCase());
  if (v.payoutMode === "owner-takes-all") {
    return memberAddress.toLowerCase() === v.ownerAddress.toLowerCase() ? v.saved : 0;
  }
  return m?.contributed ?? 0;
}

// --- on-chain actions -------------------------------------------------------

export async function contributeToShared(id: string, amountUsd: number): Promise<void> {
  await depositShared(BigInt(id), parseUnits(String(amountUsd), TOKEN_DECIMALS));
}
export async function approveSharedUnlock(id: string): Promise<void> {
  await approveSharedEarlyExit(BigInt(id));
}
export async function withdrawFromShared(id: string): Promise<void> {
  await withdrawShared(BigInt(id));
}

// --- drafts (off-chain assembly) --------------------------------------------

export type NewDraftInput = {
  name: string;
  icon: string;
  goal: number;
  deadlineDays: number;
  payoutMode: PayoutMode;
};

export async function createDraft(input: NewDraftInput): Promise<string> {
  const res = await fetch("/api/drafts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      owner: currentUser(),
      name: input.name,
      icon: input.icon,
      goal: String(input.goal),
      deadlineDays: input.deadlineDays,
      payout: input.payoutMode === "owner-takes-all" ? 1 : 0,
    }),
  });
  if (!res.ok) throw new Error("draft-create-failed");
  const { draftId } = (await res.json()) as { draftId: string };
  return draftId;
}

export async function getDraft(draftId: string): Promise<Draft | null> {
  const res = await fetch(`/api/drafts/${draftId}`);
  if (!res.ok) return null;
  const d = (await res.json()) as Omit<Draft, "payoutMode"> & { payout: number };
  return { ...d, payoutMode: d.payout === 1 ? "owner-takes-all" : "by-contribution" };
}

export async function joinDraft(draftId: string, memberName: string): Promise<void> {
  const res = await fetch(`/api/drafts/${draftId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "join", member: currentUser(), memberName }),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(e.error ?? "join-failed");
  }
}

export async function removeDraftMember(draftId: string, member: string): Promise<void> {
  await fetch(`/api/drafts/${draftId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "remove", owner: currentUser(), member }),
  });
}

/** Launch a draft on-chain: create the SharedVault with the assembled roster + the
 *  owner's initial deposit, then record the on-chain id on the draft. Returns the id. */
export async function launchDraft(draftId: string, initialDepositUsd: number): Promise<string> {
  const d = await getDraft(draftId);
  if (!d) throw new Error("draft-not-found");
  const ownerLc = d.owner.toLowerCase();
  const members = d.members
    .map((m) => m.address)
    .filter((a) => a.toLowerCase() !== ownerLc) as Address[];
  const chainNow = await readChainNow();
  const deadline = chainNow + BigInt(Math.max(1, d.deadlineDays) * 86400);
  const id = await createSharedVault({
    goal: parseUnits(d.goal, TOKEN_DECIMALS),
    deadline,
    payout: d.payoutMode === "owner-takes-all" ? 1 : 0,
    members,
    deposit: parseUnits(String(initialDepositUsd), TOKEN_DECIMALS),
  });
  await fetch(`/api/drafts/${draftId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "launch", owner: currentUser(), vaultId: id.toString() }),
  });
  return id.toString();
}

export const SHARED_CHAIN_ID = CHAIN_ID;
