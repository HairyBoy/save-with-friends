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

import { parseUnits, zeroAddress, type Address } from "viem";
import {
  activeChain,
  getActiveAccount,
  isLocalChain,
  isTestEnv,
  toCop,
  toUsd,
  TOKEN_DECIMALS,
  YIELD_AVAILABLE,
} from "@/lib/chains";
import {
  advanceChainTime,
  approveEarlyExit as approveEarlyExitOnchain,
  approveEarlyExitAs,
  createSoloVault as createSoloVaultOnchain,
  deposit as depositOnchain,
  withdraw as withdrawOnchain,
  approveToken,
  readChainNow,
  readKeyholders,
  readKeyholderVaultIds,
  readOwnerVaultIds,
  readPrizeTokenBalance,
  readTokenBalance,
  readUnlocked,
  readVault,
  readWithdrawable,
  type OnchainVault,
  type SoloVariant,
} from "@/lib/onchainVaults";
import { getFriends as loadFriends, resolveNames } from "@/lib/friends";
import {
  getSharedReceiving as realSharedReceiving,
  getSharedGroupTotal as realSharedGroupTotal,
} from "@/lib/sharedVaults";

// The social graph lives in lib/friends; re-export its surface here so every screen
// reads it through this seam. Friends are added only by invite link (no add-by-address),
// and shown by self-chosen display names — addresses are never surfaced.
export type { Friend, InviteInfo } from "@/lib/friends";
export {
  getFriends,
  removeFriend,
  getMyName,
  setMyName,
  mintInvite,
  getInvite,
  acceptFriendInvite,
} from "@/lib/friends";
import { RAFFLE_BASE_PRIZE_COPM, type RaffleWinner } from "@/lib/raffle";

// The active chain id scopes synced vault metadata (names/emojis) per chain.
const CHAIN_ID = activeChain.id;

// Whether local-only dev affordances (the time-travel panel) should be available.
export const IS_DEV_CHAIN = isLocalChain;
// Whether testnet-friendly dev affordances ("approve as keyholder") are available.
export const IS_TEST_ENV = isTestEnv;
// Whether Aave-backed "earning" vaults work on this chain (drives the create toggle).
export { YIELD_AVAILABLE } from "@/lib/chains";

// Solo vaults can live in the plain escrow OR the Aave-yield contract, two separate
// contracts whose ids both start at 1. We namespace the yield ones with a "y" prefix
// in the UI-facing string id (plain stays a bare number, backward-compatible) so they
// never collide and every per-id action can recover which contract to call.
function parseSoloId(id: string): { variant: SoloVariant; num: bigint } {
  return id.startsWith("y")
    ? { variant: "yield", num: BigInt(id.slice(1)) }
    : { variant: "plain", num: BigInt(id) };
}

function soloIdStr(num: bigint, variant: SoloVariant): string {
  return variant === "yield" ? `y${num.toString()}` : num.toString();
}

export type VaultCurrency = "USD";

// A solo (on-chain) vault in human-USD form. Group vaults are a separate type
// (lib/sharedVaults: SharedVault).
export type Vault = {
  id: string;
  name: string;
  icon: string; // emoji chosen at creation
  goal: number; // target amount
  saved: number; // currently locked
  currency: VaultCurrency;
  deadline: string | null; // ISO yyyy-mm-dd unlock date (the timer); null = no timer
  deadlineUnix?: number; // exact unlock timestamp (unix seconds)
  earning: boolean; // true = Aave-yield vault (principal supplied to Aave while locked)
  yieldEarned: number; // accrued Aave yield so far (0 for non-earning vaults)
  createdAt: string; // ISO yyyy-mm-dd
  ownerAddress?: Address; // the on-chain owner — tells an owner viewer apart from a keyholder
};

export type SavingsSummary = {
  currentlySaving: number; // sum locked across active vaults right now
  savedAllTime: number; // cumulative ever saved (incl. past/completed vaults)
  currency: VaultCurrency;
};

export type { RaffleWinner };

export type DailyPrize = {
  amountCopm: number; // prize pool, paid in COPm (base + any rollover)
  funded: boolean; // is the prize wallet funded? if not, there's no draw this day
  winChancePct: number; // this user's chance of winning today (= your share of total deposits)
  yourDepositsUsd: number; // how much YOU deposited today (USD) — your weight in the draw
  totalDepositsUsd: number; // everyone's deposits today (USD) — the denominator
  disqualified: boolean; // you withdrew this window, so you're out of today's draw
  youWonCopm: number | null; // set if YOU won the most recent draw (for the 🎉 banner)
  yourCopmBalance: number; // your COPm balance (prize token) — winnings sit here
  winners: RaffleWinner[]; // recent past winners (newest first; [] until the draw job runs)
};

// The connected user's address: the local dev account on Anvil, or the connected
// MiniPay wallet on Celo. Falls back to the zero address before a wallet connects
// (reads then return empty / zero rather than throwing — owner-of-nothing).
function currentUser(): Address {
  return getActiveAccount() ?? zeroAddress;
}

// --- off-chain vault metadata (name/emoji), synced via /api/vault-meta -------
// The contract doesn't store a vault's name/emoji; we keep it in the DB keyed by
// (chain, vault id) so it follows the user across devices and a keyholder opening
// the vault link sees the real name. Reads are batched; writes are best-effort.

type VaultMeta = { name: string; icon: string; createdAt: string | null };

async function fetchVaultMeta(ids: string[]): Promise<Map<string, VaultMeta>> {
  const map = new Map<string, VaultMeta>();
  if (ids.length === 0) return map;
  try {
    const res = await fetch(`/api/vault-meta?chainId=${CHAIN_ID}&ids=${ids.join(",")}`);
    if (res.ok) {
      const rows = (await res.json()) as { id: string; name: string; icon: string; createdAt: string | null }[];
      for (const r of rows) map.set(r.id, { name: r.name, icon: r.icon, createdAt: r.createdAt });
    }
  } catch {
    /* best-effort — the UI falls back to default name/icon */
  }
  return map;
}

async function writeVaultMeta(id: string, name: string, icon: string, createdAt: string): Promise<void> {
  try {
    await fetch("/api/vault-meta", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chainId: CHAIN_ID, vaultId: id, owner: currentUser(), name, icon, createdAt }),
    });
  } catch {
    /* best-effort — the vault exists on-chain regardless; the name can be re-set */
  }
}

// --- on-chain solo vault <-> UI Vault ---------------------------------------

function unixToIsoDate(unix: bigint): string {
  return new Date(Number(unix) * 1000).toISOString().slice(0, 10);
}

// Map an on-chain solo vault (+ its synced metadata) into the UI shape. The meta is
// fetched in batch by the caller and passed in, so this stays synchronous. For yield
// vaults, `saved` is principal and `yieldEarned` is the accrued extra (withdrawable −
// principal), so the goal/progress reads off principal while yield shows separately.
function mapSoloVault(
  num: bigint,
  v: OnchainVault,
  variant: SoloVariant,
  meta?: VaultMeta,
  withdrawableWei?: bigint,
): Vault {
  const idStr = soloIdStr(num, variant);
  const saved = toUsd(v.saved);
  const earned =
    variant === "yield" && withdrawableWei !== undefined
      ? Math.max(0, toUsd(withdrawableWei) - saved)
      : 0;
  return {
    id: idStr,
    name: meta?.name ?? "Vault",
    icon: meta?.icon ?? "🔒",
    goal: toUsd(v.goal),
    saved,
    currency: "USD",
    deadline: unixToIsoDate(v.deadline),
    deadlineUnix: Number(v.deadline),
    earning: variant === "yield",
    yieldEarned: earned,
    createdAt: meta?.createdAt ?? unixToIsoDate(v.deadline),
    ownerAddress: v.owner,
  };
}

// Read every (non-closed) solo vault of one variant the current user owns.
async function getSoloVaultsOfVariant(variant: SoloVariant): Promise<Vault[]> {
  const owner = currentUser();
  const ids = await readOwnerVaultIds(owner, variant);
  if (ids.length === 0) return [];
  const metaMap = await fetchVaultMeta(ids.map((id) => soloIdStr(id, variant)));
  const vaults = await Promise.all(
    ids.map(async (id) => {
      const v = await readVault(id, variant);
      if (v.closed) return null;
      const withdrawableWei = variant === "yield" ? await readWithdrawable(id) : undefined;
      return mapSoloVault(id, v, variant, metaMap.get(soloIdStr(id, variant)), withdrawableWei);
    }),
  );
  return vaults.filter((v): v is Vault => v !== null);
}

// Read every (non-closed) solo vault the current user owns across BOTH the plain and
// (where Aave exists) the yield contract, newest first.
async function getOnchainSoloVaults(): Promise<Vault[]> {
  const groups = await Promise.all([
    getSoloVaultsOfVariant("plain"),
    YIELD_AVAILABLE ? getSoloVaultsOfVariant("yield") : Promise.resolve([] as Vault[]),
  ]);
  return groups.flat().reverse();
}

// --- public API ------------------------------------------------------------

// Solo vaults only. Shared (group) vaults are a separate contract + screen now —
// the home reads them via useSharedVaults / lib/sharedVaults.
export async function getVaults(): Promise<Vault[]> {
  return getOnchainSoloVaults();
}

export async function getVault(id: string): Promise<Vault | null> {
  const { variant, num } = parseSoloId(id);
  const v = await readVault(num, variant);
  if (v.owner === "0x0000000000000000000000000000000000000000") return null; // no such vault
  const metaMap = await fetchVaultMeta([id]);
  const withdrawableWei = variant === "yield" ? await readWithdrawable(num) : undefined;
  return mapSoloVault(num, v, variant, metaMap.get(id), withdrawableWei);
}

// A friend's vault the connected user can help unlock (they're a keyholder).
export type KeyholderVault = {
  id: string;
  name: string;
  icon: string;
  ownerName: string | null; // resolved display name of the owner; null → "a friend"
  saved: number;
  goal: number;
};

/**
 * Vaults the connected user holds a KEY for and that still need action (open + not
 * yet unlocked). Discovered on-chain from KeyholderAdded events — no shared link
 * needed. Tapping one opens /vault/[id], where the keyholder approves from their
 * own wallet. Closed/already-unlocked vaults are filtered out (nothing to do).
 */
export async function getKeyholderVaults(): Promise<KeyholderVault[]> {
  const ids = await readKeyholderVaultIds(currentUser());
  if (ids.length === 0) return [];
  const metaMap = await fetchVaultMeta(ids.map((id) => id.toString()));
  const rows = await Promise.all(
    ids.map(async (id) => {
      const v = await readVault(id);
      if (v.closed || (await readUnlocked(id))) return null; // withdrawn or already unlocked
      return { id: id.toString(), v };
    }),
  );
  const open = rows.filter((r): r is { id: string; v: OnchainVault } => r !== null);
  if (open.length === 0) return [];
  const names = await resolveNames(open.map((r) => r.v.owner));
  return open.map((r) => {
    const meta = metaMap.get(r.id);
    return {
      id: r.id,
      name: meta?.name ?? "Vault",
      icon: meta?.icon ?? "🔒",
      ownerName: names[r.v.owner.toLowerCase()] ?? null,
      saved: toUsd(r.v.saved),
      goal: toUsd(r.v.goal),
    };
  });
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

// Shared-vault balances now come from the REAL on-chain shared vaults (lib/sharedVaults).
// (The in-memory shared stub below is dead and slated for removal.)
export async function getSharedReceiving(): Promise<number> {
  return realSharedReceiving();
}
export async function getSharedGroupTotal(): Promise<number> {
  return realSharedGroupTotal();
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
  copm: number; // COP raffle winnings (prize token) — a separate currency, NOT in total
}> {
  const [personal, sharedReceiving, wallet, copm] = await Promise.all([
    getSoloVaultedBalance(),
    getSharedReceiving(),
    getWalletBalance(),
    readPrizeTokenBalance(currentUser())
      .then(toCop)
      .catch(() => 0),
  ]);
  return {
    personal,
    sharedReceiving,
    wallet,
    total: personal + sharedReceiving + wallet, // USD only — COP winnings are separate
    copm,
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

// Today's weighted-raffle prize (COPm). Entries are derived from on-chain deposits
// in /api/raffle; 1 entry per $1 locked this window. Best-effort: on any failure
// we return a sane empty state (base prize, no entries) so the screen still renders.
export async function getDailyPrize(): Promise<DailyPrize> {
  const empty = (): DailyPrize => ({
    amountCopm: RAFFLE_BASE_PRIZE_COPM,
    funded: false,
    winChancePct: 0,
    yourDepositsUsd: 0,
    totalDepositsUsd: 0,
    disqualified: false,
    youWonCopm: null,
    yourCopmBalance: 0,
    winners: [],
  });
  try {
    const res = await fetch(`/api/raffle?address=${currentUser()}`);
    if (!res.ok) return empty();
    const d = (await res.json()) as {
      prizeCopm: number;
      funded: boolean;
      yourDepositsUsd: number;
      totalDepositsUsd: number;
      winChancePct: number;
      disqualified: boolean;
      youWonCopm: number | null;
      yourCopmBalance: number;
      winners: RaffleWinner[];
    };
    return {
      amountCopm: d.prizeCopm,
      funded: d.funded ?? false,
      winChancePct: d.winChancePct,
      yourDepositsUsd: d.yourDepositsUsd,
      totalDepositsUsd: d.totalDepositsUsd,
      disqualified: d.disqualified ?? false,
      youWonCopm: d.youWonCopm ?? null,
      yourCopmBalance: d.yourCopmBalance ?? 0,
      winners: d.winners ?? [],
    };
  } catch {
    return empty();
  }
}

export type NewVaultInput = {
  name: string;
  icon: string;
  goal: number;
  deposit: number; // the creator's starting amount
  deadline: string | null;
  friendIds: string[]; // keyholders who can approve an early unlock
  earn?: boolean; // true = create an Aave-yield vault (only where YIELD_AVAILABLE)
};

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

// Create a solo vault: real on-chain create + initial deposit (approve → createVault).
// The picked friends become real on-chain keyholders (their addresses), so any one of
// them can approve an early unlock (solo threshold = 1). Friends without an address are
// skipped. Picks are also saved as metadata for display.
export async function createVault(input: NewVaultInput): Promise<Vault> {
  if (!input.deadline) {
    throw new Error("a deadline is required"); // the form enforces this; belt-and-suspenders
  }
  const friends = await loadFriends();

  // Earning vaults only exist where Aave does; guard so a stray flag on a testnet
  // can't route to an undeployed ("0x") contract.
  const variant: SoloVariant = input.earn && YIELD_AVAILABLE ? "yield" : "plain";

  const keyholders = input.friendIds
    .map((fid) => friends.find((f) => f.id === fid)?.address)
    .filter((a): a is Address => Boolean(a));
  const num = await createSoloVaultOnchain({
    goal: parseUnits(String(input.goal), TOKEN_DECIMALS),
    deadline: await deadlineToUnix(input.deadline),
    deposit: parseUnits(String(input.deposit), TOKEN_DECIMALS),
    keyholders,
    variant,
  });

  const idStr = soloIdStr(num, variant);
  const createdAt = new Date().toISOString().slice(0, 10);
  await writeVaultMeta(idStr, input.name, input.icon, createdAt);

  const v = await readVault(num, variant);
  const withdrawableWei = variant === "yield" ? await readWithdrawable(num) : undefined;
  return mapSoloVault(num, v, variant, { name: input.name, icon: input.icon, createdAt }, withdrawableWei);
}

// --- solo vault actions (on-chain) — for the detail screen's buttons --------

/** Add funds to a solo vault (approve then deposit). `amount` is human USD. */
export async function depositToVault(id: string, amount: number): Promise<void> {
  const { variant, num } = parseSoloId(id);
  const wei = parseUnits(String(amount), TOKEN_DECIMALS);
  await approveToken(wei, variant);
  await depositOnchain(num, wei, variant);
}

/** Withdraw a solo vault once it's unlocked (closes it). */
export async function withdrawVault(id: string): Promise<void> {
  const { variant, num } = parseSoloId(id);
  await withdrawOnchain(num, variant);
}

export type VaultKeyholder = { address: string; name: string | null };

/** The friends who hold a key to a solo vault, resolved to display names (null when
 *  the keyholder hasn't set a name — the UI shows a generic "a friend", never a 0x). */
export async function getVaultKeyholders(id: string): Promise<VaultKeyholder[]> {
  if (id.startsWith("shared-")) return []; // shared keys are a v2 concern
  const { variant, num } = parseSoloId(id);
  const addrs = await readKeyholders(num, variant);
  const names = await resolveNames(addrs);
  return addrs.map((a) => ({ address: a, name: names[a.toLowerCase()] ?? null }));
}

/** A keyholder approves an early unlock from their OWN connected wallet — the real
 *  production path. The viewer must be a keyholder of this vault (the contract
 *  enforces it; the owner can't self-approve). One approval unlocks a solo vault. */
export async function approveUnlock(id: string): Promise<void> {
  const { variant, num } = parseSoloId(id);
  await approveEarlyExitOnchain(num, variant);
}

/** DEV/TEST: approve an early unlock AS a given keyholder, to drive the
 *  friend-approves-unlock flow. Locally we sign client-side with the public Anvil
 *  key; on testnet the keyholder's key is server-only, so we sign via the
 *  /api/dev/approve-as route (key never reaches the client). One approval unlocks. */
export async function devApproveAsKeyholder(id: string, keyholder: string): Promise<void> {
  if (isLocalChain) {
    const { variant, num } = parseSoloId(id);
    await approveEarlyExitAs(num, keyholder as Address, variant);
    return;
  }
  const res = await fetch("/api/dev/approve-as", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, keyholder }),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(e.error ?? "approve-as failed");
  }
}

/** Live unlock check for a solo vault (goal/deadline/approvals). */
export async function isVaultUnlocked(id: string): Promise<boolean> {
  if (id.startsWith("shared-")) return false; // shared unlock is a v2 concern
  const { variant, num } = parseSoloId(id);
  return readUnlocked(num, variant);
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
