// Name/emoji for LAUNCHED shared vaults, by their on-chain id. Shared-vault metadata
// lives in the draft it was launched from (not vault_meta, which is solo-keyed), so
// this resolves names for the home list + detail screen. Public read.
import { ensureSchema, getSql, isDbConfigured } from "@/lib/db";

export async function GET(req: Request) {
  if (!isDbConfigured()) return Response.json({ error: "database not configured" }, { status: 503 });
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return Response.json([]);
  await ensureSchema();
  const rows = await getSql()`
    select launched_vault_id as id, name, icon, payout
    from vault_drafts where launched_vault_id = any(${ids})`;
  return Response.json(rows);
}
