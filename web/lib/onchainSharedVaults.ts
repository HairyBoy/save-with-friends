// Low-level on-chain access to SharedVaults — the bigint/wei world for GROUP vaults.
// Sibling of lib/onchainVaults.ts (solo). The human-facing layer (lib/sharedVaults.ts)
// converts to/from plain USD and merges off-chain metadata.
//
// Group vaults come in two variants — the plain escrow (SharedVaults) and the
// Aave-yield one (YieldSharedVaults). Both expose identical signatures, so every call
// is just a switch of the (address, abi) pair (contractFor). The yield variant also
// has potValue()/memberValue() views, read separately with their concrete ABI.

import { erc20Abi, parseEventLogs, type Address, type Hash } from "viem";
import { CONTRACTS, FEE_OPTS, getPublicClient, getWalletClient } from "@/lib/chains";
import { sharedVaultsAbi } from "@/lib/sharedVaultsAbi";
import { yieldSharedVaultsAbi } from "@/lib/yieldSharedVaultsAbi";

// Payout modes (must match the contract's enum order).
export const PAYOUT_BY_CONTRIBUTION = 0;
export const PAYOUT_OWNER_TAKES_ALL = 1;

// Which shared contract a vault lives in: the plain escrow or the Aave-yield variant.
export type SharedVariant = "plain" | "yield";

// The vault struct as the contract returns it (getVault).
export type OnchainSharedVault = {
  owner: Address;
  deadline: bigint; // uint64 unix seconds
  closed: boolean;
  payout: number; // uint8 (0 = by-contribution, 1 = owner-takes-all)
  goalReached: boolean;
  goal: bigint; // wei
  saved: bigint; // wei principal pooled (yield held separately as scaled shares)
  scaledSaved?: bigint; // yield variant only
  approvals: number; // uint32
  memberCount: number; // uint32
};

// Type the chosen ABI against the plain one for viem inference (signatures match);
// the runtime value is the variant's real ABI, so the yield getVault still decodes
// its extra fields. Reads are cast to OnchainSharedVault. See the solo twin for why.
function contractFor(variant: SharedVariant) {
  const address = variant === "yield" ? CONTRACTS.yieldSharedVaults : CONTRACTS.sharedVaults;
  const abi = (
    variant === "yield" ? yieldSharedVaultsAbi : sharedVaultsAbi
  ) as unknown as typeof sharedVaultsAbi;
  return { address, abi } as const;
}

// --- reads -----------------------------------------------------------------

export async function readSharedVault(id: bigint, variant: SharedVariant = "plain"): Promise<OnchainSharedVault> {
  const v = await getPublicClient().readContract({ ...contractFor(variant), functionName: "getVault", args: [id] });
  return v as OnchainSharedVault;
}

export async function readSharedMembers(id: bigint, variant: SharedVariant = "plain"): Promise<Address[]> {
  const m = await getPublicClient().readContract({ ...contractFor(variant), functionName: "getMembers", args: [id] });
  return [...m];
}

/** The ids of every shared vault this address is a member of (incl. ones they own). */
export async function readMemberVaultIds(member: Address, variant: SharedVariant = "plain"): Promise<bigint[]> {
  const ids = await getPublicClient().readContract({
    ...contractFor(variant),
    functionName: "getMemberVaults",
    args: [member],
  });
  return [...ids];
}

export async function readSharedUnlocked(id: bigint, variant: SharedVariant = "plain"): Promise<boolean> {
  return getPublicClient().readContract({ ...contractFor(variant), functionName: "unlocked", args: [id] });
}

export async function readContribution(id: bigint, member: Address, variant: SharedVariant = "plain"): Promise<bigint> {
  return getPublicClient().readContract({
    ...contractFor(variant),
    functionName: "contributionOf",
    args: [id, member],
  });
}

export async function readHasApproved(id: bigint, member: Address, variant: SharedVariant = "plain"): Promise<boolean> {
  return getPublicClient().readContract({ ...contractFor(variant), functionName: "hasApproved", args: [id, member] });
}

/** Current redeemable value of the whole pot (principal + yield), yield variant only. */
export async function readSharedPotValue(id: bigint): Promise<bigint> {
  return getPublicClient().readContract({
    address: CONTRACTS.yieldSharedVaults,
    abi: yieldSharedVaultsAbi,
    functionName: "potValue",
    args: [id],
  });
}

/** Current redeemable value of a member's stake (principal + its yield), yield only. */
export async function readSharedMemberValue(id: bigint, member: Address): Promise<bigint> {
  return getPublicClient().readContract({
    address: CONTRACTS.yieldSharedVaults,
    abi: yieldSharedVaultsAbi,
    functionName: "memberValue",
    args: [id, member],
  });
}

// --- writes ----------------------------------------------------------------

async function send(hash: Hash) {
  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") throw new Error("Transaction reverted on-chain");
  return receipt;
}

/** Approve the shared contract (plain or yield) to pull `amount` of the token. */
async function approveSharedToken(amount: bigint, variant: SharedVariant): Promise<void> {
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    address: CONTRACTS.token,
    abi: erc20Abi,
    functionName: "approve",
    args: [contractFor(variant).address, amount],
    ...FEE_OPTS,
  });
  await send(hash);
}

/**
 * Launch a shared vault with a FIXED member set + the owner's initial deposit, in
 * two txns (approve → createVault). `members` are the invited addresses (the owner
 * is added by the contract). Returns the new id from the VaultCreated event.
 */
export async function createSharedVault(args: {
  goal: bigint;
  deadline: bigint;
  payout: number;
  members: Address[];
  deposit: bigint;
  variant?: SharedVariant;
}): Promise<bigint> {
  const variant = args.variant ?? "plain";
  const wallet = getWalletClient();
  const publicClient = getPublicClient();

  if (args.deposit > 0n) await approveSharedToken(args.deposit, variant);

  const hash = await wallet.writeContract({
    ...contractFor(variant),
    functionName: "createVault",
    args: [args.goal, args.deadline, args.payout, args.members, args.deposit],
    ...FEE_OPTS,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") throw new Error("createVault reverted on-chain");

  const [created] = parseEventLogs({ abi: contractFor(variant).abi, eventName: "VaultCreated", logs: receipt.logs });
  if (!created) throw new Error("VaultCreated event missing from receipt");
  return created.args.id;
}

/** A member adds their own funds (approve → deposit). `amount` is wei. */
export async function depositShared(id: bigint, amount: bigint, variant: SharedVariant = "plain"): Promise<void> {
  await approveSharedToken(amount, variant);
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    ...contractFor(variant),
    functionName: "deposit",
    args: [id, amount],
    ...FEE_OPTS,
  });
  await send(hash);
}

/** A member approves an early exit (unlocks on strict majority). */
export async function approveSharedEarlyExit(id: bigint, variant: SharedVariant = "plain"): Promise<void> {
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    ...contractFor(variant),
    functionName: "approveEarlyExit",
    args: [id],
    ...FEE_OPTS,
  });
  await send(hash);
}

/** Withdraw once unlocked (own share, or the whole pot if owner-takes-all). */
export async function withdrawShared(id: bigint, variant: SharedVariant = "plain"): Promise<void> {
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    ...contractFor(variant),
    functionName: "withdraw",
    args: [id],
    ...FEE_OPTS,
  });
  await send(hash);
}
