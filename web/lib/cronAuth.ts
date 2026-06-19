// Shared auth for the raffle cron routes (draw + payout). Vercel Cron sends
// `Authorization: Bearer <CRON_SECRET>`; we require it with a constant-time
// compare so the routes can't be triggered by the public and the secret can't be
// probed via response timing. Server-only.

import { createHash, timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Returns a Response to short-circuit with if the request is NOT an authorized
 * cron call (missing secret config → 503; bad/absent token → 401), or null if the
 * caller is authorized.
 */
export function cronAuthError(req: Request): Response | null {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!safeEqual(req.headers.get("authorization") ?? "", `Bearer ${process.env.CRON_SECRET}`)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
