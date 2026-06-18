// Friends list (synced, per-user). Friendships are pure edges — display names come
// from the `users` table (see /api/users), so this returns name, never an address
// for display. There's no "add by address" path: friendships are created only by
// accepting an invite (/api/invite). Scoped by the MiniPay-connected owner address.
import { isAddress } from "viem";
import { ensureSchema, getSql, isDbConfigured } from "@/lib/db";

const lc = (a: string) => a.toLowerCase();
const noDb = () => Response.json({ error: "database not configured" }, { status: 503 });

// GET ?owner=0x.. → [{ address, name }] (name is the friend's self-chosen name, or null)
export async function GET(req: Request) {
  if (!isDbConfigured()) return noDb();
  const owner = new URL(req.url).searchParams.get("owner");
  if (!owner || !isAddress(owner)) return Response.json({ error: "valid owner required" }, { status: 400 });
  await ensureSchema();
  const rows = await getSql()`
    select f.friend_address as address, u.display_name as name
    from friends f left join users u on u.address = f.friend_address
    where f.owner_address = ${lc(owner)}
    order by f.created_at`;
  return Response.json(rows);
}

// DELETE { owner, address } → remove a friend from your list (one direction).
export async function DELETE(req: Request) {
  if (!isDbConfigured()) return noDb();
  const { owner, address } = (await req.json()) as { owner?: string; address?: string };
  if (!owner || !isAddress(owner) || !address || !isAddress(address)) {
    return Response.json({ error: "valid owner and address required" }, { status: 400 });
  }
  await ensureSchema();
  await getSql()`delete from friends where owner_address = ${lc(owner)} and friend_address = ${lc(address)}`;
  return Response.json({ ok: true });
}
