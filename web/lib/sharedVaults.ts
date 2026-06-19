// Data-access layer for SHARED (group) vaults — the human-USD seam the screens read.
// Mirrors lib/vaults.ts (solo): on-chain reads/writes via lib/onchainSharedVaults,
// names from the friends/users layer, and the off-chain DRAFT assembly (/api/drafts).
// Shared vaults live on their own contract + route (/shared/[id]); names come from the
// draft they were launched from.

import { formatUnits, parseUnits, zeroAddress, type Address } from "viem";
import { activeChain, getActiveAccount, TOKEN_DECIMALS, YIELD_AVAILABLE } from "@/lib/chains";
import { readChainNow } from "@/lib/onchainVaults";
import {
  approveSharedEarlyExit,
  createSharedVault,
  depositShared,
  PAYOUT_OWNER_TAKES_ALL,
  readContribution,
  readMemberVaultIds,
  readSharedMemberValue,
  readSharedMembers,
  readSharedPotValue,
  readSharedUnlocked,
  readSharedVault,
  withdrawShared,
  type OnchainSharedVault,
  type SharedVariant,
} from "@/lib/onchainSharedVaults";
import { resolveNames } from "@/lib/friends";

// Re-export so screens can gate the create-flow earn toggle through this seam.
export { YIELD_AVAILABLE } from "@/lib/chains";

// Plain and yield shared vaults are separate contracts whose ids both start at 1, so
// the UI-facing id namespaces the yield ones with a "y" prefix (plain stays a bare
// number). Every per-id action recovers the variant from the prefix.
function parseSharedId(id: string): { variant: SharedVariant; num: bigint } {
  return id.startsWith("y")
    ? { variant: "yield", num: BigInt(id.slice(1)) }
    : { variant: "plain", num: BigInt(id) };
}

function sharedIdStr(num: bigint, variant: SharedVariant): string {
  return variant === "yield" ? `y${num.toString()}` : num.toString();
}

export type PayoutMode = "by-contribution" | "owner-takes-all";

export type SharedMember = {
  address: string;
  name: string | null; // resolved display name; null → "a friend" in the UI
  contributed: number; // USD
  isOwner: boolean;
};

export type SharedVault = {
  id: string; // UI id: bare number (plain) or "y"-prefixed (yield)
  name: string;
  icon: string;
  goal: number;
  saved: number; // principal pooled (yield shown separately)
  currency: "USD";
  deadlineUnix: number;
  ownerAddress: Address;
  payoutMode: PayoutMode;
  earning: boolean; // Aave-yield vault?
  yieldEarned: number; // accrued pot yield (detail only; 0 in the list / non-earning)
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
  earn: boolean; // launch as an Aave-yield shared vault?
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

function mapLight(
  num: bigint,
  variant: SharedVariant,
  v: OnchainSharedVault,
  meta?: { name: string; icon: string },
): SharedVault {
  return {
    id: sharedIdStr(num, variant),
    name: meta?.name ?? "Shared vault",
    icon: meta?.icon ?? "🏖️",
    goal: toUsd(v.goal),
    saved: toUsd(v.saved),
    currency: "USD",
    deadlineUnix: Number(v.deadline),
    ownerAddress: v.owner,
    payoutMode: payoutModeOf(v),
    earning: variant === "yield",
    yieldEarned: 0, // pot yield is read in getSharedVault (detail); 0 here
    memberCount: v.memberCount,
    approvals: v.approvals,
  };
}

// --- reads ------------------------------------------------------------------

// Every (non-closed) shared vault of one variant the user is a member of.
async function getSharedVaultsOfVariant(variant: SharedVariant): Promise<SharedVault[]> {
  const me = currentUser();
  const ids = await readMemberVaultIds(me, variant);
  if (ids.length === 0) return [];
  const meta = await fetchSharedMeta(ids.map((i) => sharedIdStr(i, variant)));
  const out = await Promise.all(
    ids.map(async (id) => {
      const v = await readSharedVault(id, variant);
      return v.closed ? null : mapLight(id, variant, v, meta.get(sharedIdStr(id, variant)));
    }),
  );
  return out.filter((x): x is SharedVault => x !== null);
}

/** Every (non-closed) shared vault the current user is a member of, across the plain
 *  and (where Aave exists) yield contracts. Light (no per-member detail) — home list. */
export async function getSharedVaults(): Promise<SharedVault[]> {
  const me = currentUser();
  if (me === zeroAddress) return [];
  const groups = await Promise.all([
    getSharedVaultsOfVariant("plain"),
    YIELD_AVAILABLE ? getSharedVaultsOfVariant("yield") : Promise.resolve([] as SharedVault[]),
  ]);
  return groups.flat().reverse();
}

/** One shared vault with full member + contribution detail — for the detail screen.
 *  For earning vaults, contributions/pot reflect current value (principal + yield). */
export async function getSharedVault(id: string): Promise<SharedVault | null> {
  const { variant, num } = parseSharedId(id);
  const v = await readSharedVault(num, variant);
  if (v.owner === zeroAddress) return null;
  const earning = variant === "yield";
  const memberAddrs = await readSharedMembers(num, variant);
  const [names, contribs, meta, potValueWei] = await Promise.all([
    resolveNames(memberAddrs),
    // Earning: each member's redeemable value (principal + their yield). Plain: their contribution.
    Promise.all(
      memberAddrs.map((a) =>
        earning ? readSharedMemberValue(num, a) : readContribution(num, a, variant),
      ),
    ),
    fetchSharedMeta([id]),
    earning ? readSharedPotValue(num) : Promise.resolve(v.saved),
  ]);
  const ownerLc = v.owner.toLowerCase();
  const members: SharedMember[] = memberAddrs.map((a, i) => ({
    address: a,
    name: names[a.toLowerCase()] ?? null,
    contributed: toUsd(contribs[i]),
    isOwner: a.toLowerCase() === ownerLc,
  }));
  const base = mapLight(num, variant, v, meta.get(id));
  const potValue = toUsd(potValueWei);
  return { ...base, members, yieldEarned: earning ? Math.max(0, potValue - base.saved) : 0 };
}

export async function getSharedUnlocked(id: string): Promise<boolean> {
  const { variant, num } = parseSharedId(id);
  return readSharedUnlocked(num, variant);
}

/** The full pooled total across the shared vaults the user is in (everyone's money).
 *  Feeds the home "currently saving" figure. */
export async function getSharedGroupTotal(): Promise<number> {
  const vaults = await getSharedVaults();
  return vaults.reduce((sum, v) => sum + v.saved, 0);
}

/** What the user will receive across their shared vaults (USD): their own contribution
 *  (by-contribution) or the pot if they own an owner-takes-all vault. For the Me page. */
export async function getSharedReceiving(): Promise<number> {
  const me = currentUser();
  if (me === zeroAddress) return 0;
  const meLc = me.toLowerCase();
  const vaults = await getSharedVaults();
  let total = 0;
  for (const v of vaults) {
    const { variant, num } = parseSharedId(v.id);
    if (v.payoutMode === "owner-takes-all") {
      // The owner receives the whole pot — its current value (principal + yield) if earning.
      if (v.ownerAddress.toLowerCase() === meLc) {
        total += variant === "yield" ? toUsd(await readSharedPotValue(num)) : v.saved;
      }
    } else {
      // Each member receives their own stake — current value if earning.
      total +=
        variant === "yield"
          ? toUsd(await readSharedMemberValue(num, me))
          : toUsd(await readContribution(num, me, variant));
    }
  }
  return total;
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
  const { variant, num } = parseSharedId(id);
  await depositShared(num, parseUnits(String(amountUsd), TOKEN_DECIMALS), variant);
}
export async function approveSharedUnlock(id: string): Promise<void> {
  const { variant, num } = parseSharedId(id);
  await approveSharedEarlyExit(num, variant);
}
export async function withdrawFromShared(id: string): Promise<void> {
  const { variant, num } = parseSharedId(id);
  await withdrawShared(num, variant);
}

// --- drafts (off-chain assembly) --------------------------------------------

export type NewDraftInput = {
  name: string;
  icon: string;
  goal: number;
  deadlineDays: number;
  payoutMode: PayoutMode;
  earn?: boolean; // launch as an Aave-yield shared vault (only where YIELD_AVAILABLE)
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
      earn: Boolean(input.earn && YIELD_AVAILABLE),
    }),
  });
  if (!res.ok) throw new Error("draft-create-failed");
  const { draftId } = (await res.json()) as { draftId: string };
  return draftId;
}

export async function getDraft(draftId: string): Promise<Draft | null> {
  const res = await fetch(`/api/drafts/${draftId}`);
  if (!res.ok) return null;
  const d = (await res.json()) as Omit<Draft, "payoutMode" | "earn"> & { payout: number; earn?: boolean };
  return {
    ...d,
    payoutMode: d.payout === 1 ? "owner-takes-all" : "by-contribution",
    earn: Boolean(d.earn),
  };
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
  const variant: SharedVariant = d.earn && YIELD_AVAILABLE ? "yield" : "plain";
  const ownerLc = d.owner.toLowerCase();
  const members = d.members
    .map((m) => m.address)
    .filter((a) => a.toLowerCase() !== ownerLc) as Address[];
  const chainNow = await readChainNow();
  const deadline = chainNow + BigInt(Math.max(1, d.deadlineDays) * 86400);
  const num = await createSharedVault({
    goal: parseUnits(d.goal, TOKEN_DECIMALS),
    deadline,
    payout: d.payoutMode === "owner-takes-all" ? 1 : 0,
    members,
    deposit: parseUnits(String(initialDepositUsd), TOKEN_DECIMALS),
    variant,
  });
  const vaultId = sharedIdStr(num, variant);
  await fetch(`/api/drafts/${draftId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "launch", owner: currentUser(), vaultId }),
  });
  return vaultId;
}

export const SHARED_CHAIN_ID = CHAIN_ID;
