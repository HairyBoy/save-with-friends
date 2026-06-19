// Daily COPm raffle — the PAYOUT JOB (P3). Runs a few minutes after the draw (see
// web/vercel.json) and also serves as the retry path. It finds recorded winners
// that haven't been paid and sends them the prize from the hot prize wallet.
//
// Auth: same `CRON_SECRET` bearer as the draw. `?dryRun=1` lists what would be paid
// without sending. Kept SEPARATE from the draw so an on-chain payout failure never
// blocks recording the winner, and so the spending key only loads in this route.
//
// No double-pay: each winner row is CLAIMED atomically (drawn → paying) before the
// transfer, so a concurrent run can't pay the same row twice. On success → paid +
// tx hash; on failure → released back to drawn for retry. If the process dies after
// the transfer but before marking paid, the row stays `paying` (stuck, not double-
// paid — the safe failure mode) for manual reconciliation against the tx history.

import { type Address } from "viem";
import { activeChain } from "@/lib/chains";
import { cronAuthError } from "@/lib/cronAuth";
import { ensureSchema, getSql, isDbConfigured } from "@/lib/db";
import { sendPrize } from "@/lib/prizePayout";

// Uses node:crypto (via cronAuth) → pin the Node runtime, matching the repo convention.
export const runtime = "nodejs";

type Paid = { id: number; winner: string; prizeCopm: number; txHash: string };
type Failed = { id: number; winner: string; error: string };

export async function GET(req: Request) {
  const authErr = cronAuthError(req);
  if (authErr) return authErr;

  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  if (!isDbConfigured()) {
    return Response.json({ error: "database not configured" }, { status: 503 });
  }

  const chainId = activeChain.id;
  await ensureSchema();
  const sql = getSql();

  // Recorded winners not yet paid: 'drawn' rows with a winner.
  const pending = await sql`
    select id, winner_address, prize_copm
    from raffle_draws
    where chain_id = ${chainId} and status = 'drawn' and winner_address is not null
    order by draw_at asc`;

  if (dryRun) {
    return Response.json({
      dryRun: true,
      pending: pending.map((r) => ({
        id: Number(r.id),
        winner: r.winner_address as string,
        prizeCopm: Number(r.prize_copm),
      })),
    });
  }

  const paid: Paid[] = [];
  const failed: Failed[] = [];
  for (const row of pending) {
    const id = Number(row.id);
    const winner = row.winner_address as string;
    const prizeCopm = Number(row.prize_copm);

    // Claim atomically so a concurrent payout run can't pay this row too.
    const claim = await sql`
      update raffle_draws set status = 'paying'
      where id = ${id} and status = 'drawn'
      returning id`;
    if (claim.length === 0) continue; // another runner claimed it

    try {
      const txHash = await sendPrize(winner as Address, prizeCopm);
      await sql`update raffle_draws set status = 'paid', payout_tx_hash = ${txHash} where id = ${id}`;
      paid.push({ id, winner, prizeCopm, txHash });
    } catch (e) {
      // Release the claim so a later run retries.
      await sql`update raffle_draws set status = 'drawn' where id = ${id} and status = 'paying'`;
      failed.push({ id, winner, error: (e as Error).message });
    }
  }

  return Response.json({ ok: true, paidCount: paid.length, failedCount: failed.length, paid, failed });
}
