// Daily COPm raffle — the DRAW JOB (P2). Invoked once a day by Vercel Cron at
// 17:00 UTC (noon Bogotá; see web/vercel.json). It draws the window that just
// closed: snapshot the qualifying entries, pick a weighted winner with a CSPRNG,
// and record the draw. It does NOT pay out — that's P3; the winner is just recorded.
//
// Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; we require it.
// `?dryRun=1` computes and returns the would-be draw WITHOUT writing (preview /
// test). `?at=<unix>` overrides the reference time (test / backfill a missed day).
//
// Idempotent: a unique (chain_id, draw_at) index + `on conflict do nothing` means
// a re-fire (cron retry, double trigger) is a no-op rather than a double draw.

import { randomBytes } from "node:crypto";
import { activeChain } from "@/lib/chains";
import { cronAuthError } from "@/lib/cronAuth";
import { getSql, isDbConfigured } from "@/lib/db";
import { readChainNow } from "@/lib/onchainVaults";
import { isPrizeFunded } from "@/lib/prizePayout";
import { closedWindow, decideDraw, RAFFLE_BASE_PRIZE_COPM } from "@/lib/raffle";
import { getRolloverCopm } from "@/lib/raffleDb";
import { readWindowEntries, type WindowEntries } from "@/lib/raffleChain";

// This route uses node:crypto (CSPRNG) → pin the Node runtime (not Edge).
export const runtime = "nodejs";

export async function GET(req: Request) {
  const authErr = cronAuthError(req);
  if (authErr) return authErr;

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const atParam = url.searchParams.get("at");
  // `at` is an authenticated override, but validate it anyway so a typo can't write
  // a row with NaN timestamps.
  if (atParam !== null && !Number.isFinite(Number(atParam))) {
    return Response.json({ error: "invalid 'at' (expected unix seconds)" }, { status: 400 });
  }

  if (!dryRun && !isDbConfigured()) {
    return Response.json({ error: "database not configured" }, { status: 503 });
  }

  const chainId = activeChain.id;
  // Reference time → which window just closed. `at` override for tests/backfill;
  // otherwise the chain clock (deposit timestamps live on the same clock), with
  // wall clock as a last resort if the chain is briefly unreachable.
  let now = atParam ? Number(atParam) : Math.floor(Date.now() / 1000);
  if (!atParam) {
    try {
      now = Number(await readChainNow());
    } catch {
      /* keep wall-clock fallback */
    }
  }
  const window = closedWindow(now);

  // Entries for the closed window (same rule the UI displays).
  let we: WindowEntries;
  try {
    we = await readWindowEntries(window);
  } catch {
    return Response.json({ error: "chain unreachable" }, { status: 502 });
  }

  // Rollover = skipped pots accumulated SINCE the last awarded draw.
  const rolloverCopm = isDbConfigured() ? await getRolloverCopm(chainId) : 0;

  // Funding gate: a draw only runs if the prize wallet can pay the full pot when
  // the draw fires. If not, there is NO DRAW today and it does NOT roll over —
  // recorded as 'unfunded' (distinct from 'skipped', which does roll over).
  const wouldPay = RAFFLE_BASE_PRIZE_COPM + rolloverCopm;
  const funded = await isPrizeFunded(wouldPay);
  if (!funded) {
    if (dryRun) {
      return Response.json({
        dryRun: true,
        window,
        funded: false,
        status: "unfunded",
        wouldPay,
        totalWeight: we.totalWeight,
      });
    }
    const insU = await getSql()`
      insert into raffle_draws
        (chain_id, window_start, draw_at, prize_copm, status, winner_address, total_weight, random_seed)
      values
        (${chainId}, to_timestamp(${window.start}), to_timestamp(${window.drawAt}),
         0, 'unfunded', null, ${we.totalWeight}, null)
      on conflict (chain_id, draw_at) do nothing
      returning id`;
    return Response.json({
      ok: true,
      status: insU.length ? "unfunded" : "already-drawn",
      drawAt: window.drawAt,
    });
  }

  // Weighted winner via CSPRNG. The seed is stored for audit: r = (seed mod 2^53)/2^53,
  // and entries are persisted in sorted order, so anyone can reproduce the pick.
  const seedHex = "0x" + randomBytes(8).toString("hex");
  const r = Number(BigInt(seedHex) % 9007199254740992n) / 9007199254740992;
  const decision = decideDraw({
    entries: we.entries,
    basePrize: RAFFLE_BASE_PRIZE_COPM,
    rolloverCopm,
    r,
  });

  if (dryRun) {
    return Response.json({ dryRun: true, window, funded: true, rolloverCopm, seed: seedHex, ...decision });
  }

  // Persist ATOMICALLY: one statement inserts the draw AND its entry snapshot, so a
  // draw is never recorded without its entries (a retry can't leave it half-written).
  // on-conflict makes a re-fire a no-op → returns 0 rows → "already drawn".
  const sql = getSql();
  const ins = await sql`
    with d as (
      insert into raffle_draws
        (chain_id, window_start, draw_at, prize_copm, status, winner_address, total_weight, random_seed)
      values
        (${chainId}, to_timestamp(${window.start}), to_timestamp(${window.drawAt}),
         ${decision.prizeCopm}, ${decision.status}, ${decision.winner}, ${decision.totalWeight}, ${seedHex})
      on conflict (chain_id, draw_at) do nothing
      returning id
    ), e as (
      insert into raffle_entries (draw_id, address, weight_usd, deposit_count)
      select d.id, x.address, x.weight, x.deposits
      from d cross join unnest(
        ${decision.entries.map((x) => x.address)}::text[],
        ${decision.entries.map((x) => x.weight)}::numeric[],
        ${decision.entries.map((x) => x.deposits)}::int[]
      ) as x(address, weight, deposits)
    )
    select id from d`;
  if (ins.length === 0) {
    return Response.json({ ok: true, status: "already-drawn", drawAt: window.drawAt });
  }

  return Response.json({
    ok: true,
    status: decision.status,
    winner: decision.winner,
    prizeCopm: decision.prizeCopm,
    drawAt: window.drawAt,
    entries: decision.entries.length,
  });
}
