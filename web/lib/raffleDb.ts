// Shared raffle DB queries. Single source of truth for the money-correctness bits
// (the rollover sum) so the display route and the draw job can never diverge.

import { ensureSchema, getSql } from "@/lib/db";

/**
 * Rollover for `chainId`: the COPm from `skipped` draws accumulated SINCE the last
 * AWARDED draw (`drawn`/`paid`). `unfunded` days are deliberately excluded — they
 * don't roll over. Both `/api/raffle` (display) and `/api/raffle/draw` use this.
 */
export async function getRolloverCopm(chainId: number): Promise<number> {
  await ensureSchema();
  const rows = await getSql()`
    select coalesce(sum(prize_copm), 0) as total
    from raffle_draws
    where chain_id = ${chainId} and status = 'skipped'
      and draw_at > coalesce(
        (select max(draw_at) from raffle_draws
         where chain_id = ${chainId} and status in ('drawn', 'paid')),
        'epoch'::timestamptz)`;
  return Number(rows[0]?.total ?? 0);
}
