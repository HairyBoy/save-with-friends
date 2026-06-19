// Shared on-chain raffle read: turn the window's `Deposited`/`Withdrawn` events
// into qualifying entries. Server-only (uses the RPC). Both the display route
// (/api/raffle) and the draw job (/api/raffle/draw) read through this, so the
// winner is always computed from the exact same rule shown to users.
//
// Scaling note: rather than scan from genesis (which blows past RPC getLogs range
// limits on a long chain), we bound the scan to the blocks covering the window and
// page it in chunks. For high deposit volume the real fix is to index deposits
// into the DB / cache per window (P4) — this keeps the read correct but not cheap.

import { CONTRACTS, getPublicClient, toUsd } from "@/lib/chains";
import { savingsVaultsAbi } from "@/lib/savingsVaultsAbi";
import type { RaffleEntry, RaffleWindow } from "@/lib/raffle";

export type WindowEntries = {
  entries: RaffleEntry[]; // qualifying depositors (not disqualified) this window
  totalWeight: number; // sum of entry weights (USD)
  disqualified: Set<string>; // addresses that withdrew this window → out of the draw
};

type Client = ReturnType<typeof getPublicClient>;
// Just the fields we read off each event log (avoids fighting viem's union typing).
type RaffleLog = {
  blockNumber: bigint | null;
  args: { from?: `0x${string}`; to?: `0x${string}`; amount?: bigint };
};

// Block-range cap per getLogs call (most RPCs reject wider). Overridable per chain.
const LOG_CHUNK = BigInt(process.env.RAFFLE_LOG_CHUNK ?? "10000");

/**
 * Estimate the block at-or-before `fromTimestamp`, so the scan starts near the
 * window instead of at genesis. Uses recent block cadence; floored at
 * SAVINGS_VAULTS_DEPLOY_BLOCK. Over-estimates (1.25× + slack) so it never starts
 * AFTER the real first in-window block.
 */
async function estimateFromBlock(
  client: Client,
  fromTimestamp: number,
  latestNumber: bigint,
  latestTimestamp: number,
): Promise<bigint> {
  const floor = BigInt(process.env.SAVINGS_VAULTS_DEPLOY_BLOCK ?? "0");
  if (latestTimestamp <= fromTimestamp) return latestNumber > floor ? latestNumber : floor;

  const probeBack = latestNumber > 5000n ? 5000n : latestNumber;
  let secsPerBlock = 5; // conservative default if we can't measure
  if (probeBack > 0n) {
    const probe = await client.getBlock({ blockNumber: latestNumber - probeBack });
    const dt = latestTimestamp - Number(probe.timestamp);
    if (dt > 0) secsPerBlock = dt / Number(probeBack);
  }
  const spanSeconds = latestTimestamp - fromTimestamp;
  const blocksBack = BigInt(Math.ceil((spanSeconds / Math.max(secsPerBlock, 0.05)) * 1.25)) + 100n;
  const from = latestNumber > blocksBack ? latestNumber - blocksBack : 0n;
  return from > floor ? from : floor;
}

/** getContractEvents over [fromBlock, toBlock] paged in LOG_CHUNK-sized ranges. */
async function getEventsChunked(
  client: Client,
  eventName: "Deposited" | "Withdrawn",
  fromBlock: bigint,
  toBlock: bigint,
): Promise<RaffleLog[]> {
  const out: RaffleLog[] = [];
  for (let start = fromBlock; start <= toBlock; start += LOG_CHUNK) {
    const end = start + LOG_CHUNK - 1n > toBlock ? toBlock : start + LOG_CHUNK - 1n;
    const logs = await client.getContractEvents({
      address: CONTRACTS.savingsVaults,
      abi: savingsVaultsAbi,
      eventName,
      fromBlock: start,
      toBlock: end,
    });
    out.push(...(logs as unknown as RaffleLog[]));
  }
  return out;
}

/**
 * Read a window's qualifying entries from chain: deposits weighted by USD value,
 * EXCLUDING any address that withdrew during the window (anti-gaming — see
 * /api/raffle). Throws if the chain is unreachable; callers decide how to degrade.
 */
export async function readWindowEntries(window: RaffleWindow): Promise<WindowEntries> {
  const client = getPublicClient();
  const latest = await client.getBlock();
  const latestNumber = latest.number ?? 0n;
  const fromBlock = await estimateFromBlock(
    client,
    window.start,
    latestNumber,
    Number(latest.timestamp),
  );

  const [deposits, withdrawals] = await Promise.all([
    getEventsChunked(client, "Deposited", fromBlock, latestNumber),
    getEventsChunked(client, "Withdrawn", fromBlock, latestNumber),
  ]);

  // getLogs doesn't carry timestamps — fetch each unique block once and map.
  const blockNums = [
    ...new Set(
      [...deposits, ...withdrawals].map((l) => l.blockNumber).filter((b): b is bigint => b != null),
    ),
  ];
  const blocks = await Promise.all(blockNums.map((bn) => client.getBlock({ blockNumber: bn })));
  const tsByBlock = new Map(blocks.map((b) => [b.number, Number(b.timestamp)]));
  const inWindow = (blockNumber: bigint | null) => {
    const ts = blockNumber != null ? tsByBlock.get(blockNumber) : undefined;
    return ts != null && ts >= window.start && ts < window.drawAt;
  };

  // Pass 1: who withdrew this window → disqualified, regardless of deposits.
  const disqualified = new Set<string>();
  for (const log of withdrawals) {
    if (inWindow(log.blockNumber) && log.args.to) disqualified.add(log.args.to.toLowerCase());
  }

  // Pass 2: sum deposits, skipping anyone disqualified.
  const byAddr = new Map<string, { weight: number; deposits: number }>();
  let totalWeight = 0;
  for (const log of deposits) {
    if (!inWindow(log.blockNumber) || !log.args.from || log.args.amount == null) continue;
    const from = log.args.from.toLowerCase();
    if (disqualified.has(from)) continue;
    const usd = toUsd(log.args.amount);
    const cur = byAddr.get(from) ?? { weight: 0, deposits: 0 };
    cur.weight += usd;
    cur.deposits += 1;
    byAddr.set(from, cur);
    totalWeight += usd;
  }

  const entries = [...byAddr.entries()].map(([address, v]) => ({
    address,
    weight: v.weight,
    deposits: v.deposits,
  }));
  return { entries, totalWeight, disqualified };
}
