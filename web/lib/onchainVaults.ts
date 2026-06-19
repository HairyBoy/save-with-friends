// Low-level on-chain access to SavingsVaults — the bigint/wei world.
//
// Everything here speaks the contract's native types (bigint amounts, unix
// deadlines, addresses). The human-facing layer (lib/vaults.ts) converts to/from
// plain USD numbers and merges off-chain metadata. Keep that split: nothing above
// this file should touch wei or ABIs.

import { erc20Abi, parseEventLogs, type Address, type Hash } from "viem";
import {
  CONTRACTS,
  FEE_OPTS,
  getDevKeyholderWalletClient,
  getDevTestClient,
  getPublicClient,
  getWalletClient,
  PRIZE_TOKEN,
} from "@/lib/chains";
import { savingsVaultsAbi } from "@/lib/savingsVaultsAbi";

// The vault struct as the contract returns it (getVault).
export type OnchainVault = {
  owner: Address;
  deadline: bigint; // uint64 unix seconds
  closed: boolean;
  goal: bigint; // wei
  saved: bigint; // wei
  approvals: number; // uint32
  threshold: number; // uint32
};

const vaultsContract = {
  address: CONTRACTS.savingsVaults,
  abi: savingsVaultsAbi,
} as const;

// --- reads -----------------------------------------------------------------

/** The ids of every vault this owner has created (oldest first). */
export async function readOwnerVaultIds(owner: Address): Promise<bigint[]> {
  const ids = await getPublicClient().readContract({
    ...vaultsContract,
    functionName: "getOwnerVaults",
    args: [owner],
  });
  return [...ids];
}

/** Full struct for one vault. */
export async function readVault(id: bigint): Promise<OnchainVault> {
  const v = await getPublicClient().readContract({
    ...vaultsContract,
    functionName: "getVault",
    args: [id],
  });
  return v as OnchainVault;
}

/** The live unlock check (goal reached OR deadline passed OR enough approvals). */
export async function readUnlocked(id: bigint): Promise<boolean> {
  return getPublicClient().readContract({
    ...vaultsContract,
    functionName: "unlocked",
    args: [id],
  });
}

/** The owner's spendable token balance (what's in the wallet, not in vaults). */
export async function readTokenBalance(owner: Address): Promise<bigint> {
  return getPublicClient().readContract({
    address: CONTRACTS.token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  });
}

/** An owner's balance of the PRIZE token (COPm on mainnet) — for showing winnings. */
export async function readPrizeTokenBalance(owner: Address): Promise<bigint> {
  return getPublicClient().readContract({
    address: PRIZE_TOKEN,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  });
}

/**
 * The chain's current block timestamp (unix seconds). The contract enforces
 * deadlines against block.timestamp, not wall-clock time — so deadlines must be
 * anchored to this, especially when dev time-travel has pushed the chain ahead.
 */
export async function readChainNow(): Promise<bigint> {
  return (await getPublicClient().getBlock()).timestamp;
}

/** Keyholder addresses for a vault (display only). */
export async function readKeyholders(id: bigint): Promise<Address[]> {
  const ks = await getPublicClient().readContract({
    ...vaultsContract,
    functionName: "getKeyholders",
    args: [id],
  });
  return [...ks];
}

// --- writes ----------------------------------------------------------------
// Writes go through getWalletClient(): the local dev wallet on Anvil, or the
// injected MiniPay wallet on Celo. FEE_OPTS pays gas in USDm on Celo (no CELO
// needed by the user); it's empty on Anvil.

async function send(hash: Hash) {
  // Block until mined so callers can read fresh state right after. viem resolves
  // even for reverted txns, so check the status explicitly and surface a failure
  // (otherwise a reverted deposit/withdraw would look like success to the UI).
  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") {
    throw new Error("Transaction reverted on-chain");
  }
  return receipt;
}

/** ERC20 approve so the vault can pull `amount` of the token from the owner. */
export async function approveToken(amount: bigint): Promise<void> {
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    address: CONTRACTS.token,
    abi: erc20Abi,
    functionName: "approve",
    args: [CONTRACTS.savingsVaults, amount],
    ...FEE_OPTS,
  });
  await send(hash);
}

/**
 * Create a solo vault and fund it in ONE on-chain call: approve → createVault
 * (with initialDeposit). Just two transactions (down from three), and no
 * brittle create-then-deposit sequencing — the contract pulls the deposit
 * atomically inside createVault. Returns the new id (from the VaultCreated
 * event). `deadline` is unix seconds and MUST be > now (contract enforces it).
 */
export async function createSoloVault(args: {
  goal: bigint;
  deadline: bigint;
  deposit: bigint;
  keyholders: Address[];
}): Promise<bigint> {
  const wallet = getWalletClient();
  const publicClient = getPublicClient();

  // Approve the initial deposit so createVault can pull it in the same tx.
  if (args.deposit > 0n) await approveToken(args.deposit);

  const createHash = await wallet.writeContract({
    ...vaultsContract,
    functionName: "createVault",
    args: [args.goal, args.deadline, args.keyholders, args.deposit],
    ...FEE_OPTS,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
  if (receipt.status === "reverted") throw new Error("createVault reverted on-chain");

  const [created] = parseEventLogs({
    abi: savingsVaultsAbi,
    eventName: "VaultCreated",
    logs: receipt.logs,
  });
  if (!created) throw new Error("VaultCreated event missing from receipt");
  return created.args.id;
}

/** Add funds to a vault (owner-only). Caller must have approved first. */
export async function deposit(id: bigint, amount: bigint): Promise<void> {
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    ...vaultsContract,
    functionName: "deposit",
    args: [id, amount],
    ...FEE_OPTS,
  });
  await send(hash);
}

/** Withdraw the full balance once unlocked (closes the vault). */
export async function withdraw(id: bigint): Promise<void> {
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    ...vaultsContract,
    functionName: "withdraw",
    args: [id],
    ...FEE_OPTS,
  });
  await send(hash);
}

/**
 * DEV-ONLY: push the local chain's clock forward `seconds` and mine a block, so
 * timer-locked vaults cross their deadline and unlock. No-op'd on a real chain by
 * the guard in getDevTestClient.
 */
export async function advanceChainTime(seconds: number): Promise<void> {
  const test = getDevTestClient();
  await test.increaseTime({ seconds });
  await test.mine({ blocks: 1 });
}

/**
 * A keyholder approves an early exit, signed by the keyholder's OWN wallet (the
 * contract bars the owner from self-approving). Solo threshold is 1, so a single
 * approval unlocks. In dev, `keyholder` is an Anvil test account; in production
 * it's the friend's real wallet signing from their own device.
 */
export async function approveEarlyExitAs(id: bigint, keyholder: Address): Promise<void> {
  const wallet = getDevKeyholderWalletClient(keyholder);
  const hash = await wallet.writeContract({
    ...vaultsContract,
    functionName: "approveEarlyExit",
    args: [id],
  });
  await send(hash);
}

/**
 * A keyholder approves an early exit from THEIR OWN connected wallet — the real
 * production path (no custody, no server signing). The connected wallet must be a
 * keyholder of the vault (the contract enforces it; the owner can't self-approve).
 * Solo threshold is 1, so a single approval unlocks. On Celo, gas is paid in the
 * stablecoin via FEE_OPTS, so the friend needs no CELO.
 */
export async function approveEarlyExit(id: bigint): Promise<void> {
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    ...vaultsContract,
    functionName: "approveEarlyExit",
    args: [id],
    ...FEE_OPTS,
  });
  await send(hash);
}
