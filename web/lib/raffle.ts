// Daily COPm raffle — pure window + prize config (no chain, no DB, no React).
//
// The raffle draws ONCE a day at 12:00 noon America/Bogotá. Colombia is UTC−5
// year-round (no daylight saving), so every draw boundary is exactly 17:00 UTC —
// which lets us do the window math in plain UTC, no timezone library needed.
//
// Entries are weighted by how much you "locked in" (deposited into your vaults)
// during the window: 1 entry per $1, so P(win) = your weight / total weight. The
// prize is a fixed base in COPm that ROLLS OVER (stacks) on any day nobody
// qualifies. Full rationale in .private/PRIZES_PLAN.md.

// Draw fires at noon Bogotá = 17:00 UTC.
export const DRAW_HOUR_UTC = 17;

const DAY_SECONDS = 24 * 60 * 60;

// Base daily prize, paid in COPm. (Open decision: final base amount — this
// placeholder matches the figure the UI shipped with.)
export const RAFFLE_BASE_PRIZE_COPM = 4000;

/** A draw window: entries deposited in [start, drawAt) compete for that draw. */
export type RaffleWindow = {
  start: number; // unix seconds — previous noon-Bogotá
  drawAt: number; // unix seconds — next noon-Bogotá (when the draw fires)
};

/**
 * The window currently accepting entries for `nowUnix`: it ends at the next
 * noon-Bogotá strictly after now (`drawAt`) and starts at the previous one. A
 * deposit counts toward this draw iff its block timestamp is in [start, drawAt).
 */
export function currentWindow(nowUnix: number): RaffleWindow {
  const drawAt = new Date(nowUnix * 1000);
  drawAt.setUTCHours(DRAW_HOUR_UTC, 0, 0, 0);
  // If today's noon has already passed (or is exactly now), the next draw is
  // tomorrow's noon.
  if (drawAt.getTime() <= nowUnix * 1000) {
    drawAt.setUTCDate(drawAt.getUTCDate() + 1);
  }
  const drawAtUnix = Math.floor(drawAt.getTime() / 1000);
  return { start: drawAtUnix - DAY_SECONDS, drawAt: drawAtUnix };
}

/**
 * The window that has just CLOSED at `nowUnix` — its `drawAt` is the most recent
 * noon-Bogotá at or before now. This is what the daily draw job draws: the 24h
 * that ended at the boundary the cron just crossed. (By construction
 * `closedWindow(now).drawAt === currentWindow(now).start`.)
 */
export function closedWindow(nowUnix: number): RaffleWindow {
  // The boundary that just closed is exactly the open window's start, so derive it
  // from currentWindow — one source of truth for the noon-Bogotá boundary math.
  const open = currentWindow(nowUnix);
  return { start: open.start - DAY_SECONDS, drawAt: open.start };
}

/** One depositor's standing in a draw: USD weight + how many deposits made it up. */
export type RaffleEntry = { address: string; weight: number; deposits: number };

/**
 * Pick a winner weighted by entry weight, given a uniform `r` in [0,1). Walks the
 * cumulative weight line. Entries should be passed in a STABLE (sorted) order so a
 * given (entries, r) always yields the same winner — that's what makes the draw
 * auditable from the stored seed. Returns null if there's no weight to draw on.
 */
export function pickWinner(entries: RaffleEntry[], r: number): string | null {
  const total = entries.reduce((s, e) => s + e.weight, 0);
  if (total <= 0 || entries.length === 0) return null;
  let threshold = r * total;
  for (const e of entries) {
    threshold -= e.weight;
    if (threshold < 0) return e.address;
  }
  return entries[entries.length - 1].address; // float-rounding safety net
}

export type DrawDecision = {
  status: "drawn" | "skipped";
  winner: string | null;
  prizeCopm: number; // amount recorded for this draw
  totalWeight: number;
  entries: RaffleEntry[]; // sorted snapshot to persist (empty when skipped)
};

/**
 * Decide a draw from its qualifying entries (pure — no chain, no DB, no clock).
 * Nobody qualified → `skipped`, and `basePrize` is recorded so it rolls forward.
 * Otherwise a weighted winner takes `basePrize + rolloverCopm`. Entries are sorted
 * by address first so the result is reproducible from the seed `r`.
 */
export function decideDraw(args: {
  entries: RaffleEntry[];
  basePrize: number;
  rolloverCopm: number;
  r: number;
}): DrawDecision {
  const sorted = [...args.entries].sort((a, b) =>
    a.address < b.address ? -1 : a.address > b.address ? 1 : 0,
  );
  const totalWeight = sorted.reduce((s, e) => s + e.weight, 0);
  if (totalWeight <= 0 || sorted.length === 0) {
    return { status: "skipped", winner: null, prizeCopm: args.basePrize, totalWeight: 0, entries: [] };
  }
  return {
    status: "drawn",
    winner: pickWinner(sorted, args.r),
    prizeCopm: args.basePrize + args.rolloverCopm,
    totalWeight,
    entries: sorted,
  };
}

/** One past winner, for the history list on the Prize screen. */
export type RaffleWinner = {
  address: string;
  amountCopm: number;
  drawAt: number; // unix seconds — when this draw fired
};
