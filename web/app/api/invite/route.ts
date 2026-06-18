// Mint a shareable invite link. The token carries the inviter (name resolved from
// `users`) + an optional vault context (future per-vault join). Accepting it
// (/api/invite/[token]) creates a mutual friendship.
import { randomBytes } from "crypto";
import { isAddress } from "viem";
import { ensureSchema, getSql, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs"; // randomBytes

export async function POST(req: Request) {
  if (!isDbConfigured()) return Response.json({ error: "database not configured" }, { status: 503 });
  const { inviter, vaultId } = (await req.json()) as { inviter?: string; vaultId?: string };
  if (!inviter || !isAddress(inviter)) {
    return Response.json({ error: "valid inviter required" }, { status: 400 });
  }
  await ensureSchema();
  const sql = getSql();
  // The inviter must have set a display name, so the invite can show who it's from.
  const named = (await sql`select 1 from users where address = ${inviter.toLowerCase()}`) as unknown[];
  if (named.length === 0) return Response.json({ error: "set-your-name-first" }, { status: 409 });

  const token = randomBytes(9).toString("base64url"); // ~12 url-safe chars
  await sql`
    insert into invites (token, inviter_address, vault_id, expires_at)
    values (${token}, ${inviter.toLowerCase()}, ${vaultId ?? null}, now() + interval '30 days')`;
  return Response.json({ token });
}
