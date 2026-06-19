// Shared-vault drafts — the off-chain assembly stage. The owner creates a draft,
// friends join the roster via its link, then the owner launches it on-chain with a
// FIXED member set (see /api/drafts/[id]). Nothing here touches money or the chain.
import { randomBytes } from "crypto";
import { isAddress } from "viem";
import { ensureSchema, getSql, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs"; // randomBytes

export async function POST(req: Request) {
  if (!isDbConfigured()) return Response.json({ error: "database not configured" }, { status: 503 });
  const { owner, name, icon, goal, deadlineDays, payout, earn } = (await req.json()) as {
    owner?: string;
    name?: string;
    icon?: string;
    goal?: string | number;
    deadlineDays?: number;
    payout?: number;
    earn?: boolean;
  };
  if (!owner || !isAddress(owner) || !name?.trim() || !goal || !deadlineDays || deadlineDays < 1) {
    return Response.json({ error: "owner, name, goal, deadlineDays required" }, { status: 400 });
  }
  await ensureSchema();
  const id = randomBytes(9).toString("base64url");
  const sql = getSql();
  await sql`
    insert into vault_drafts (id, owner_address, name, icon, goal, deadline_days, payout, earn)
    values (${id}, ${owner.toLowerCase()}, ${name.trim().slice(0, 60)}, ${icon ?? "🏖️"}, ${String(goal)},
            ${Math.floor(deadlineDays)}, ${payout === 1 ? 1 : 0}, ${earn === true})`;
  // The owner is the first member of the roster.
  await sql`insert into draft_members (draft_id, member_address) values (${id}, ${owner.toLowerCase()})`;
  return Response.json({ draftId: id });
}
