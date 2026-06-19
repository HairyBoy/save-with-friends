// Daily COPm raffle — the read seam for the Prize screen (P1).
//
// Entries are DERIVED from on-chain `Deposited` events: every deposit into a
// vault during the current window (noon-Bogotá to noon-Bogotá) is weighted by its
// USD value, and P(win) = your weight / everyone's. The prize is a fixed base in
// COPm plus anything rolled over from days nobody qualified. Past winners come
// from the DB (written by the draw + payout jobs; empty until then).
//
// Anti-gaming: any address that made a WITHDRAWAL in the window is disqualified
// from that draw — its deposits don't count at all. Washing (deposit → withdraw →
// redeposit to farm weight) requires a withdrawal, so it disqualifies the washer;
// this caps anyone's gameable weight at the capital they actually hold locked at
// the draw (locked money can only be in one place, so multi-wallet doesn't help).
//
// Reads are PUBLIC and best-effort: if the chain is unreachable we still return
// the base prize with zero entries, and if the DB is absent we drop rollover +
// winners — the screen degrades, it never 500s.
import { activeChain } from "@/lib/chains";
import { ensureSchema, getSql, isDbConfigured } from "@/lib/db";
import { readChainNow } from "@/lib/onchainVaults";
import { currentWindow, RAFFLE_BASE_PRIZE_COPM, type RaffleWinner } from "@/lib/raffle";
import { readWindowEntries } from "@/lib/raffleChain";
import { getRolloverCopm } from "@/lib/raffleDb";
import { isPrizeFunded, prizeTokenBalanceOf } from "@/lib/prizePayout";
import type { Address } from "viem";

type DbState = { rolloverCopm: number; winners: RaffleWinner[]; youWonCopm: number | null };

export async function GET(req: Request) {
  const address = (new URL(req.url).searchParams.get("address") ?? "").toLowerCase();
  const chainId = activeChain.id;

  // Deposits are timestamped by the CHAIN, so the window must use the chain's clock
  // too — on the local dev chain (Anvil) block time can lag, or, after time-travel,
  // lead wall-clock time. Wall clock is the fallback only if the chain is unreachable.
  let now = Math.floor(Date.now() / 1000);
  try {
    now = Number(await readChainNow());
  } catch {
    /* chain unreachable — wall clock is a fine fallback */
  }
  const window = currentWindow(now);

  // Chain entries and DB state are independent — fetch them concurrently. Each
  // degrades to empty on its own failure so the screen never 500s.
  const [we, db, yourCopmBalance] = await Promise.all([
    readWindowEntries(window).catch(() => null),
    loadDbState(chainId, address),
    address ? prizeTokenBalanceOf(address as Address) : Promise.resolve(0),
  ]);

  const entries = we?.entries ?? [];
  const totalWeight = we?.totalWeight ?? 0;
  const disqualified = we?.disqualified ?? new Set<string>();

  const isDisqualified = address.length > 0 && disqualified.has(address);
  const yourWeight = isDisqualified ? 0 : (entries.find((e) => e.address === address)?.weight ?? 0);
  const winChancePct = totalWeight > 0 ? Math.round((yourWeight / totalWeight) * 100) : 0;

  const prizeCopm = RAFFLE_BASE_PRIZE_COPM + db.rolloverCopm;
  // Is the prize actually funded right now? Drives the "no draw unless funded"
  // status (the draw itself gates on this when it fires). Reads the wallet's
  // balance only — no signer is constructed on this public path.
  const funded = await isPrizeFunded(prizeCopm);

  return Response.json({
    prizeCopm,
    funded,
    yourDepositsUsd: yourWeight,
    totalDepositsUsd: totalWeight,
    winChancePct,
    disqualified: isDisqualified,
    youWonCopm: db.youWonCopm,
    yourCopmBalance,
    winners: db.winners,
  });
}

// All DB-derived state in one place, run concurrently. Winners + "you won" are
// gated on status='paid' so the UI only ever shows actually-awarded prizes (a
// recorded-but-unpaid or failed winner is not surfaced as paid). "You won" is
// scoped to the last 36h so it celebrates a recent win and then clears — and isn't
// wiped by a later unfunded/skipped draw. Never throws (defaults on any failure).
async function loadDbState(chainId: number, address: string): Promise<DbState> {
  const empty: DbState = { rolloverCopm: 0, winners: [], youWonCopm: null };
  if (!isDbConfigured()) return empty;
  try {
    await ensureSchema();
    const sql = getSql();
    const [rolloverCopm, winnerRows, wonRows] = await Promise.all([
      getRolloverCopm(chainId),
      sql`
        select winner_address, prize_copm, extract(epoch from draw_at)::bigint as draw_at
        from raffle_draws
        where chain_id = ${chainId} and status = 'paid' and winner_address is not null
        order by draw_at desc
        limit 10`,
      sql`
        select prize_copm from raffle_draws
        where chain_id = ${chainId} and status = 'paid' and lower(winner_address) = ${address}
          and draw_at > now() - interval '36 hours'
        order by draw_at desc
        limit 1`,
    ]);
    return {
      rolloverCopm,
      winners: winnerRows.map((r) => ({
        address: r.winner_address as string,
        amountCopm: Number(r.prize_copm),
        drawAt: Number(r.draw_at),
      })),
      youWonCopm: wonRows.length > 0 ? Number(wonRows[0].prize_copm) : null,
    };
  } catch {
    return empty;
  }
}
