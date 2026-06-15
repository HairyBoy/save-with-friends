// Data-access layer for Vaults — the seam every screen reads through.
//
// SOLO vaults are now REAL on-chain (SavingsVaults on the local Anvil chain):
// reads come from the contract, writes go through the dev wallet (see lib/chains).
// SHARED vaults are still an in-memory stub — the contract is solo-only (shared is
// v2). The two coexist: the UI groups them by the `shared` flag, and their ids live
// in separate spaces (on-chain solo = numeric "1","2"…; shared stub = "shared-…")
// so they never collide.
//
// The contract doesn't store a vault's name/emoji (kept lean by design), so that
// metadata lives in localStorage keyed by vault id — per-device for now, moving to
// a backend later. UI-facing types stay plain numbers (human USD); the on-chain
// wei<->USD conversion is hidden in this file.

import { formatUnits, parseUnits, type Address } from "viem";
import { devAccount, isLocalChain, TOKEN_DECIMALS } from "@/lib/chains";
import {
  advanceChainTime,
  createSoloVault as createSoloVaultOnchain,
  deposit as depositOnchain,
  withdraw as withdrawOnchain,
  approveEarlyExit as approveEarlyExitOnchain,
  approveToken,
  readChainNow,
  readOwnerVaultIds,
  readTokenBalance,
  readUnlocked,
  readVault,
  type OnchainVault,
} from "@/lib/onchainVaults";

// Whether dev-only affordances (the time-travel panel) should be available.
export const IS_DEV_CHAIN = isLocalChain;

export type VaultCurrency = "USD";

export type SplitMode = "equal" | "contribution";

// The current user's id within a shared vault's member list.
export const CURRENT_USER_ID = "me";

export type VaultMember = {
  id: string; // friend id; the current user is CURRENT_USER_ID
  name: string;
  contributed: number; // how much this member has put in
  accepted: boolean; // false = invited but hasn't joined yet
};

export type Vault = {
  id: string;
  name: string;
  icon: string; // emoji chosen at creation
  goal: number; // target amount (the shared goal, for shared vaults)
  saved: number; // currently locked (for shared = sum of member contributions)
  currency: VaultCurrency;
  deadline: string | null; // ISO yyyy-mm-dd unlock date (the timer); null = no timer
  deadlineUnix?: number; // exact unlock timestamp (unix seconds) for on-chain vaults
  yieldEarned: number; // earned by the agent while locked
  createdAt: string; // ISO yyyy-mm-dd
  shared: boolean;
  keyholders?: string[]; // solo: friend ids who can approve an early unlock
  // Shared-only:
  splitMode?: SplitMode; // how funds split when the vault unlocks
  members?: VaultMember[]; // contributors (incl. the owner); all must unlock
  inviteStatus?: "accepted" | "pending"; // current user's status on this shared vault
  ownerName?: string; // who created it / sent the invite (shown on pending)
};

export type SavingsSummary = {
  currentlySaving: number; // sum locked across active vaults right now
  savedAllTime: number; // cumulative ever saved (incl. past/completed vaults)
  currency: VaultCurrency;
};

export type DailyPrize = {
  amountCopm: number; // prize pool, paid in COPm
  winChancePct: number; // this user's chance of winning today
  yourEntries: number; // your raffle entries (1 per $1 locked today)
  totalEntries: number; // everyone's entries today
};

export type Friend = { id: string; name: string };

// The connected user's address. For now it's the Anvil dev account (everything is
// owned by / read for that account); becomes the MiniPay wallet address later.
function currentUser(): Address {
  return devAccount.address;
}

// --- off-chain vault metadata (name/emoji/created/keyholder picks) ----------
// localStorage-backed, keyed by on-chain vault id. Per-device for now.

type VaultMeta = {
  name: string;
  icon: string;
  createdAt: string; // ISO yyyy-mm-dd
  keyholderFriendIds: string[]; // the friends the owner picked (display only for now)
};

const META_PREFIX = "vault-meta:";

function readMeta(id: string): VaultMeta | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(META_PREFIX + id);
  return raw ? (JSON.parse(raw) as VaultMeta) : null;
}

function writeMeta(id: string, meta: VaultMeta): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(META_PREFIX + id, JSON.stringify(meta));
}

// --- on-chain solo vault <-> UI Vault ---------------------------------------

function unixToIsoDate(unix: bigint): string {
  return new Date(Number(unix) * 1000).toISOString().slice(0, 10);
}

function toUsd(wei: bigint): number {
  return Number(formatUnits(wei, TOKEN_DECIMALS));
}

// Map an on-chain solo vault (+ its localStorage metadata) into the UI shape.
function mapSoloVault(id: bigint, v: OnchainVault): Vault {
  const idStr = id.toString();
  const meta = readMeta(idStr);
  return {
    id: idStr,
    name: meta?.name ?? "Vault",
    icon: meta?.icon ?? "🔒",
    goal: toUsd(v.goal),
    saved: toUsd(v.saved),
    currency: "USD",
    deadline: unixToIsoDate(v.deadline),
    deadlineUnix: Number(v.deadline),
    yieldEarned: 0, // no yield in v1
    createdAt: meta?.createdAt ?? unixToIsoDate(v.deadline),
    shared: false,
    keyholders: meta?.keyholderFriendIds ?? [],
  };
}

// Read every (non-closed) solo vault the current user owns, newest first.
async function getOnchainSoloVaults(): Promise<Vault[]> {
  const ids = await readOwnerVaultIds(currentUser());
  const vaults = await Promise.all(
    ids.map(async (id) => {
      const v = await readVault(id);
      return v.closed ? null : mapSoloVault(id, v);
    }),
  );
  return vaults.filter((v): v is Vault => v !== null).reverse();
}

// --- shared vaults (in-memory stub; ids namespaced "shared-…") --------------

const FAKE_FRIENDS: Friend[] = [
  { id: "ana", name: "Ana" },
  { id: "luis", name: "Luis" },
];

let SHARED_VAULTS: Vault[] = [
  {
    id: "shared-1",
    name: "Beach house",
    icon: "🏠",
    goal: 2000,
    saved: 700,
    currency: "USD",
    deadline: "2027-01-15",
    yieldEarned: 12.4,
    createdAt: "2026-05-01",
    shared: true,
    splitMode: "contribution",
    ownerName: "You",
    inviteStatus: "accepted",
    members: [
      { id: CURRENT_USER_ID, name: "You", contributed: 300, accepted: true },
      { id: "ana", name: "Ana", contributed: 250, accepted: true },
      { id: "luis", name: "Luis", contributed: 150, accepted: true },
    ],
  },
  {
    id: "shared-2",
    name: "Sofía's birthday gift",
    icon: "🎁",
    goal: 300,
    saved: 150,
    currency: "USD",
    deadline: "2026-08-20",
    yieldEarned: 1.1,
    createdAt: "2026-06-02",
    shared: true,
    splitMode: "equal",
    ownerName: "Ana",
    inviteStatus: "pending",
    members: [
      { id: "ana", name: "Ana", contributed: 90, accepted: true },
      { id: "luis", name: "Luis", contributed: 60, accepted: true },
      { id: CURRENT_USER_ID, name: "You", contributed: 0, accepted: false },
    ],
  },
];

// --- public API (signatures unchanged; solo is on-chain, shared is stub) ----

export async function getVaults(): Promise<Vault[]> {
  const solo = await getOnchainSoloVaults();
  return [...solo, ...SHARED_VAULTS];
}

export async function getVault(id: string): Promise<Vault | null> {
  // Shared stub ids are non-numeric ("shared-…"); on-chain solo ids are numeric.
  if (id.startsWith("shared-")) {
    return SHARED_VAULTS.find((v) => v.id === id) ?? null;
  }
  const v = await readVault(BigInt(id));
  if (v.owner === "0x0000000000000000000000000000000000000000") return null; // no such vault
  return mapSoloVault(BigInt(id), v);
}

/**
 * What `memberId` receives from a vault when it unlocks (USD), by its split mode:
 * by-contribution → each member gets their own contribution back; equal → the pot
 * is divided across the accepted members. Principal only — yield shows separately.
 * Single seam for "what everyone gets back": the vault card's Receives column and
 * the Me page's "receiving from shared" both read it, so they always agree.
 * (Solo vaults: you receive your whole balance.)
 */
export function vaultPayout(v: Vault, memberId: string): number {
  if (!v.shared) return v.saved;
  const members = v.members ?? [];
  if (v.splitMode === "equal") {
    const sharers = members.filter((m) => m.accepted);
    if (!sharers.some((m) => m.id === memberId)) return 0; // not (yet) sharing
    return sharers.length > 0 ? v.saved / sharers.length : 0;
  }
  // by contribution (default): you get back what you put in
  return members.find((m) => m.id === memberId)?.contributed ?? 0;
}

/** Spendable money in the user's wallet (USD) — what deposits draw from. */
export async function getWalletBalance(): Promise<number> {
  return toUsd(await readTokenBalance(currentUser()));
}

/** The user's stake locked in REAL on-chain (solo) vaults (USD). */
export async function getSoloVaultedBalance(): Promise<number> {
  const solo = await getOnchainSoloVaults();
  return solo.reduce((sum, v) => sum + v.saved, 0);
}

/**
 * What the user will receive across their (accepted) shared vaults (USD) — their
 * payout. Under by-contribution this equals what they put in; under equal split
 * it may not. Stub data for now (shared is v2), but a single seam: swap the body
 * for a real on-chain read later and every caller updates at once.
 */
export async function getSharedReceiving(): Promise<number> {
  return SHARED_VAULTS.filter((v) => v.inviteStatus === "accepted").reduce(
    (sum, v) => sum + vaultPayout(v, CURRENT_USER_ID),
    0,
  );
}

/**
 * The full pooled total across the user's (accepted) shared vaults — EVERYONE's
 * money, not just the user's slice. Same stub seam as above. The home "currently
 * saving" figure counts this whole group pot; the Me page counts only your slice
 * (getSharedVaultedBalance). Pending invites you haven't joined aren't counted.
 */
export async function getSharedGroupTotal(): Promise<number> {
  return SHARED_VAULTS.filter((v) => v.inviteStatus === "accepted").reduce(
    (sum, v) => sum + v.saved,
    0,
  );
}

/**
 * The user's money broken out for the Me page: what's in your personal (solo)
 * vaults, what you'll receive from shared vaults, and what's still spendable in
 * your wallet — which sum to your total.
 * Caveat while shared vaults are stub data: the shared slice isn't backed by real
 * on-chain escrow, so `total` runs ahead of the real wallet by that stubbed
 * amount until shared vaults go on-chain (then it reconciles).
 */
export async function getBalances(): Promise<{
  personal: number;
  sharedReceiving: number;
  wallet: number;
  total: number;
}> {
  const [personal, sharedReceiving, wallet] = await Promise.all([
    getSoloVaultedBalance(),
    getSharedReceiving(),
    getWalletBalance(),
  ]);
  return {
    personal,
    sharedReceiving,
    wallet,
    total: personal + sharedReceiving + wallet,
  };
}

export async function getSavingsSummary(): Promise<SavingsSummary> {
  // "Currently saving" is the collective figure: your own money from solo vaults
  // PLUS the full pooled total of the group vaults you're in (everyone's money,
  // not just your slice). This differs on purpose from the Me page, which counts
  // only your personal stake + your own shared payout (getBalances).
  const [solo, groupTotal] = await Promise.all([
    getSoloVaultedBalance(),
    getSharedGroupTotal(),
  ]);
  const currentlySaving = solo + groupTotal;
  // Lifetime total also counts past/completed vaults (stubbed extra until we
  // track withdrawn-vault history on-chain).
  const savedAllTime = currentlySaving + 1080;
  return { currentlySaving, savedAllTime, currency: "USD" };
}

// Today's weighted-raffle prize (COPm). 1 entry per $1 locked today; stubbed.
export async function getDailyPrize(): Promise<DailyPrize> {
  const yourEntries = 320;
  const totalEntries = 1780;
  return {
    amountCopm: 4000,
    winChancePct: Math.round((yourEntries / totalEntries) * 100),
    yourEntries,
    totalEntries,
  };
}

export async function getFriends(): Promise<Friend[]> {
  return FAKE_FRIENDS;
}

export type NewVaultInput = {
  name: string;
  icon: string;
  goal: number;
  deposit: number; // the creator's starting amount
  deadline: string | null;
  shared: boolean;
  splitMode: SplitMode;
  friendIds: string[]; // solo: keyholders · shared: invited members
};

let nextSharedId = 100;

// Smallest gap (seconds) we leave between the on-chain deadline and the chain's
// "now", so a freshly-created vault is always strictly in the future even if the
// user picked today (or the clocks line up exactly).
const MIN_DEADLINE_BUFFER_SECONDS = 60;

// Convert a required "yyyy-mm-dd" timer to a unix deadline the contract accepts.
//
// We anchor to the CHAIN's clock, not the browser's. The contract enforces
// deadline > block.timestamp, and the dev time-travel panel (evm_increaseTime)
// permanently advances block.timestamp — so on a fast-forwarded chain a plain
// wall-clock deadline ("3 months from now") can land in the chain's PAST and the
// create reverts with "deadline<=now". To stay correct in both worlds we take
// the user's intended DURATION (chosen date − wall-clock now) and apply it to
// chain time: deadline = chainNow + duration (floored to a small buffer). On a
// live chain block.timestamp ≈ wall clock, so this resolves to ~the user's
// chosen date; it only diverges when dev time-travel has moved the chain ahead.
async function deadlineToUnix(deadline: string): Promise<bigint> {
  // End of the chosen day, so the timer is safely late in the day.
  const chosenWallUnix = BigInt(
    Math.floor(new Date(`${deadline}T23:59:59`).getTime() / 1000),
  );
  const wallNow = BigInt(Math.floor(Date.now() / 1000));
  // The user's intended duration from "now" (never negative).
  const duration = chosenWallUnix > wallNow ? chosenWallUnix - wallNow : 0n;
  const chainNow = await readChainNow();
  const buffer = BigInt(MIN_DEADLINE_BUFFER_SECONDS);
  // Anchor to chain time, but never less than a small buffer in the future.
  return chainNow + (duration > buffer ? duration : buffer);
}

// Create a vault. Solo → real on-chain create + initial deposit; shared → stub.
export async function createVault(input: NewVaultInput): Promise<Vault> {
  if (!input.deadline) {
    throw new Error("a deadline is required"); // the form enforces this; belt-and-suspenders
  }

  if (input.shared) {
    // --- shared stub (in-memory) ---
    const id = `shared-${nextSharedId++}`;
    const vault: Vault = {
      id,
      name: input.name,
      icon: input.icon,
      goal: input.goal,
      saved: input.deposit,
      currency: "USD",
      deadline: input.deadline,
      yieldEarned: 0,
      createdAt: new Date().toISOString().slice(0, 10),
      shared: true,
      splitMode: input.splitMode,
      ownerName: "You",
      inviteStatus: "accepted",
      members: [
        { id: CURRENT_USER_ID, name: "You", contributed: input.deposit, accepted: true },
        ...input.friendIds.map((fid) => ({
          id: fid,
          name: FAKE_FRIENDS.find((f) => f.id === fid)?.name ?? fid,
          contributed: 0,
          accepted: false,
        })),
      ],
    };
    SHARED_VAULTS = [...SHARED_VAULTS, vault];
    return vault;
  }

  // --- solo: real on-chain create (approve → createVault → deposit) ---
  // Keyholders are passed empty on-chain for now: app friends have no on-chain
  // address yet (the social graph is off-chain), so the picks are saved as display
  // metadata only. The early-exit approval flow becomes real once friends carry
  // addresses; goal/deadline unlock paths already work.
  const id = await createSoloVaultOnchain({
    goal: parseUnits(String(input.goal), TOKEN_DECIMALS),
    deadline: await deadlineToUnix(input.deadline),
    deposit: parseUnits(String(input.deposit), TOKEN_DECIMALS),
    keyholders: [],
  });

  const idStr = id.toString();
  writeMeta(idStr, {
    name: input.name,
    icon: input.icon,
    createdAt: new Date().toISOString().slice(0, 10),
    keyholderFriendIds: input.friendIds,
  });

  const v = await readVault(id);
  return mapSoloVault(id, v);
}

// --- solo vault actions (on-chain) — for the detail screen's buttons --------

/** Add funds to a solo vault (approve then deposit). `amount` is human USD. */
export async function depositToVault(id: string, amount: number): Promise<void> {
  const wei = parseUnits(String(amount), TOKEN_DECIMALS);
  await approveToken(wei);
  await depositOnchain(BigInt(id), wei);
}

/** Withdraw a solo vault once it's unlocked (closes it). */
export async function withdrawVault(id: string): Promise<void> {
  await withdrawOnchain(BigInt(id));
}

/** A keyholder approves an early exit on a solo vault. */
export async function requestEarlyExit(id: string): Promise<void> {
  await approveEarlyExitOnchain(BigInt(id));
}

/** Live unlock check for a solo vault (goal/deadline/approvals). */
export async function isVaultUnlocked(id: string): Promise<boolean> {
  if (id.startsWith("shared-")) return false; // shared unlock is a v2 concern
  return readUnlocked(BigInt(id));
}

/** DEV-ONLY: jump the local chain forward N days (to watch timer vaults unlock). */
export async function devFastForward(days: number): Promise<void> {
  await advanceChainTime(days * 24 * 60 * 60);
}

/** The chain's current time (unix seconds): real on a live chain, simulated on
 *  the dev chain after time-travel. Drives the dev panel's clock readout. */
export async function getChainNow(): Promise<number> {
  return Number(await readChainNow());
}

// Accept a pending shared-vault invite (you become an accepted member).
export async function acceptInvite(id: string): Promise<void> {
  const vault = SHARED_VAULTS.find((v) => v.id === id);
  if (vault?.shared && vault.inviteStatus === "pending") {
    vault.inviteStatus = "accepted";
    const me = vault.members?.find((m) => m.id === CURRENT_USER_ID);
    if (me) me.accepted = true;
  }
}

// Decline a pending invite (drop it from your list).
export async function declineInvite(id: string): Promise<void> {
  SHARED_VAULTS = SHARED_VAULTS.filter((v) => v.id !== id);
}
