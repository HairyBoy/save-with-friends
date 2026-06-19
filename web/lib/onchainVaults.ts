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
import { yieldSavingsVaultsAbi } from "@/lib/yieldSavingsVaultsAbi";

// The vault struct as the contract returns it (getVault).
export type OnchainVault = {
  owner: Address;
  deadline: bigint; // uint64 unix seconds
  closed: boolean;
  goal: bigint; // wei
  saved: bigint; // wei (principal; yield is held separately as scaled aToken shares)
  scaledSaved?: bigint; // yield variant only — Aave scaled shares (principal + yield)
  approvals: number; // uint32
  threshold: number; // uint32
};

// Which solo contract a vault lives in: the plain escrow or the Aave-yield variant.
// Both expose identical create/deposit/withdraw/approve/getVault signatures, so the
// only thing that changes per call is the (address, abi) pair below.
export type SoloVariant = "plain" | "yield";

// The plain and yield ABIs share identical create/deposit/withdraw/approve/getVault/
// unlocked/getKeyholders signatures, so we type the chosen ABI against the plain one
// for viem's inference. The RUNTIME value is still the variant's real ABI (so the
// yield getVault decodes its extra scaledSaved field); reads are cast to OnchainVault.
// The yield-only `withdrawable` view is read separately with its concrete ABI below.
function contractFor(variant: SoloVariant) {
  const address = variant === "yield" ? CONTRACTS.yieldSavingsVaults : CONTRACTS.savingsVaults;
  const abi = (
    variant === "yield" ? yieldSavingsVaultsAbi : savingsVaultsAbi
  ) as unknown as typeof savingsVaultsAbi;
  return { address, abi } as const;
}

// --- reads -----------------------------------------------------------------

/** The ids of every vault this owner has created (oldest first). */
export async function readOwnerVaultIds(owner: Address, variant: SoloVariant = "plain"): Promise<bigint[]> {
  const ids = await getPublicClient().readContract({
    ...contractFor(variant),
    functionName: "getOwnerVaults",
    args: [owner],
  });
  return [...ids];
}

/** Full struct for one vault. */
export async function readVault(id: bigint, variant: SoloVariant = "plain"): Promise<OnchainVault> {
  const v = await getPublicClient().readContract({
    ...contractFor(variant),
    functionName: "getVault",
    args: [id],
  });
  return v as OnchainVault;
}

/** Current redeemable value (principal + accrued Aave yield), yield variant only. */
export async function readWithdrawable(id: bigint): Promise<bigint> {
  return getPublicClient().readContract({
    address: CONTRACTS.yieldSavingsVaults,
    abi: yieldSavingsVaultsAbi,
    functionName: "withdrawable",
    args: [id],
  });
}

/** The live unlock check (goal reached OR deadline passed OR enough approvals). */
export async function readUnlocked(id: bigint, variant: SoloVariant = "plain"): Promise<boolean> {
  return getPublicClient().readContract({
    ...contractFor(variant),
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
export async function readKeyholders(id: bigint, variant: SoloVariant = "plain"): Promise<Address[]> {
  const ks = await getPublicClient().readContract({
    ...contractFor(variant),
    functionName: "getKeyholders",
    args: [id],
  });
  return [...ks];
}

/**
 * The vault ids the given address is a KEYHOLDER of — so a friend's vaults can
 * surface in their app with no shared link. The contract has no reverse getter for
 * keyholders (unlike owners / shared members), so we read the `KeyholderAdded`
 * event, whose `keyholder` is indexed → the RPC filters server-side. Scanned in
 * bounded chunks (a deploy-block floor → latest) to stay under getLogs range limits.
 * Plain solo vaults only for now — yield-vault keyholders are a follow-up (they'd
 * need variant-aware reads + a variant-aware vault detail screen).
 */
export async function readKeyholderVaultIds(keyholder: Address): Promise<bigint[]> {
  const client = getPublicClient();
  const latest = await client.getBlock();
  const latestNum = latest.number ?? 0n;
  const chunk = BigInt(process.env.RAFFLE_LOG_CHUNK ?? "10000");
  let from = BigInt(process.env.SAVINGS_VAULTS_DEPLOY_BLOCK ?? "0");
  const ids = new Set<bigint>();
  for (; from <= latestNum; from += chunk) {
    const to = from + chunk - 1n > latestNum ? latestNum : from + chunk - 1n;
    const logs = await client.getContractEvents({
      ...contractFor("plain"),
      eventName: "KeyholderAdded",
      args: { keyholder },
      fromBlock: from,
      toBlock: to,
    });
    for (const log of logs) {
      const id = (log.args as { id?: bigint }).id;
      if (id != null) ids.add(id);
    }
  }
  return [...ids];
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

/** ERC20 approve so the vault can pull `amount` of the token from the owner. The
 *  spender is the specific solo contract (plain or yield) the deposit targets. */
export async function approveToken(amount: bigint, variant: SoloVariant = "plain"): Promise<void> {
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
  variant?: SoloVariant;
}): Promise<bigint> {
  const variant = args.variant ?? "plain";
  const wallet = getWalletClient();
  const publicClient = getPublicClient();

  // Approve the initial deposit so createVault can pull it in the same tx.
  if (args.deposit > 0n) await approveToken(args.deposit, variant);

  const createHash = await wallet.writeContract({
    ...contractFor(variant),
    functionName: "createVault",
    args: [args.goal, args.deadline, args.keyholders, args.deposit],
    ...FEE_OPTS,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
  if (receipt.status === "reverted") throw new Error("createVault reverted on-chain");

  // VaultCreated has the same shape in both ABIs; parse with whichever we used.
  const [created] = parseEventLogs({
    abi: contractFor(variant).abi,
    eventName: "VaultCreated",
    logs: receipt.logs,
  });
  if (!created) throw new Error("VaultCreated event missing from receipt");
  return created.args.id;
}

/** Add funds to a vault (owner-only). Caller must have approved first. */
export async function deposit(id: bigint, amount: bigint, variant: SoloVariant = "plain"): Promise<void> {
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    ...contractFor(variant),
    functionName: "deposit",
    args: [id, amount],
    ...FEE_OPTS,
  });
  await send(hash);
}

/** Withdraw the full balance once unlocked (closes the vault). */
export async function withdraw(id: bigint, variant: SoloVariant = "plain"): Promise<void> {
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    ...contractFor(variant),
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
export async function approveEarlyExitAs(
  id: bigint,
  keyholder: Address,
  variant: SoloVariant = "plain",
): Promise<void> {
  const wallet = getDevKeyholderWalletClient(keyholder);
  const hash = await wallet.writeContract({
    ...contractFor(variant),
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
export async function approveEarlyExit(id: bigint, variant: SoloVariant = "plain"): Promise<void> {
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    ...contractFor(variant),
    functionName: "approveEarlyExit",
    args: [id],
    ...FEE_OPTS,
  });
  await send(hash);
}
