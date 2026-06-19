// Low-level on-chain access to SharedVaults — the bigint/wei world for GROUP vaults.
// Sibling of lib/onchainVaults.ts (solo). The human-facing layer (lib/vaults.ts)
// converts to/from plain USD and merges off-chain metadata.

import { erc20Abi, parseEventLogs, type Address, type Hash } from "viem";
import { CONTRACTS, FEE_OPTS, getPublicClient, getWalletClient } from "@/lib/chains";
import { sharedVaultsAbi } from "@/lib/sharedVaultsAbi";

// Payout modes (must match the contract's enum order).
export const PAYOUT_BY_CONTRIBUTION = 0;
export const PAYOUT_OWNER_TAKES_ALL = 1;

// The vault struct as the contract returns it (getVault).
export type OnchainSharedVault = {
  owner: Address;
  deadline: bigint; // uint64 unix seconds
  closed: boolean;
  payout: number; // uint8 (0 = by-contribution, 1 = owner-takes-all)
  goalReached: boolean;
  goal: bigint; // wei
  saved: bigint; // wei (pooled, not yet withdrawn)
  approvals: number; // uint32
  memberCount: number; // uint32
};

const sharedContract = {
  address: CONTRACTS.sharedVaults,
  abi: sharedVaultsAbi,
} as const;

// --- reads -----------------------------------------------------------------

export async function readSharedVault(id: bigint): Promise<OnchainSharedVault> {
  const v = await getPublicClient().readContract({ ...sharedContract, functionName: "getVault", args: [id] });
  return v as OnchainSharedVault;
}

export async function readSharedMembers(id: bigint): Promise<Address[]> {
  const m = await getPublicClient().readContract({ ...sharedContract, functionName: "getMembers", args: [id] });
  return [...m];
}

/** The ids of every shared vault this address is a member of (incl. ones they own). */
export async function readMemberVaultIds(member: Address): Promise<bigint[]> {
  const ids = await getPublicClient().readContract({
    ...sharedContract,
    functionName: "getMemberVaults",
    args: [member],
  });
  return [...ids];
}

export async function readSharedUnlocked(id: bigint): Promise<boolean> {
  return getPublicClient().readContract({ ...sharedContract, functionName: "unlocked", args: [id] });
}

export async function readContribution(id: bigint, member: Address): Promise<bigint> {
  return getPublicClient().readContract({ ...sharedContract, functionName: "contributionOf", args: [id, member] });
}

export async function readHasApproved(id: bigint, member: Address): Promise<boolean> {
  return getPublicClient().readContract({ ...sharedContract, functionName: "hasApproved", args: [id, member] });
}

// --- writes ----------------------------------------------------------------

async function send(hash: Hash) {
  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") throw new Error("Transaction reverted on-chain");
  return receipt;
}

/** Approve the SharedVaults contract to pull `amount` of the token from the caller. */
async function approveSharedToken(amount: bigint): Promise<void> {
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    address: CONTRACTS.token,
    abi: erc20Abi,
    functionName: "approve",
    args: [CONTRACTS.sharedVaults, amount],
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
}): Promise<bigint> {
  const wallet = getWalletClient();
  const publicClient = getPublicClient();

  if (args.deposit > 0n) await approveSharedToken(args.deposit);

  const hash = await wallet.writeContract({
    ...sharedContract,
    functionName: "createVault",
    args: [args.goal, args.deadline, args.payout, args.members, args.deposit],
    ...FEE_OPTS,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") throw new Error("createVault reverted on-chain");

  const [created] = parseEventLogs({ abi: sharedVaultsAbi, eventName: "VaultCreated", logs: receipt.logs });
  if (!created) throw new Error("VaultCreated event missing from receipt");
  return created.args.id;
}

/** A member adds their own funds (approve → deposit). `amount` is wei. */
export async function depositShared(id: bigint, amount: bigint): Promise<void> {
  await approveSharedToken(amount);
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    ...sharedContract,
    functionName: "deposit",
    args: [id, amount],
    ...FEE_OPTS,
  });
  await send(hash);
}

/** A member approves an early exit (unlocks on strict majority). */
export async function approveSharedEarlyExit(id: bigint): Promise<void> {
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    ...sharedContract,
    functionName: "approveEarlyExit",
    args: [id],
    ...FEE_OPTS,
  });
  await send(hash);
}

/** Withdraw once unlocked (own share, or the whole pot if owner-takes-all). */
export async function withdrawShared(id: bigint): Promise<void> {
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    ...sharedContract,
    functionName: "withdraw",
    args: [id],
    ...FEE_OPTS,
  });
  await send(hash);
}
