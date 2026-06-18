// Friends list (synced, per-user). Scoped by the owner's wallet address, which
// arrives from the MiniPay-authenticated client. This is cosmetic/social data
// (nicknames + addresses) — no funds — so address-scoping is the chosen boundary
// (MiniPay can't message-sign for a stronger proof; see lib/db.ts).
import { isAddress } from "viem";
import { ensureSchema, getSql, isDbConfigured } from "@/lib/db";

const lc = (a: string) => a.toLowerCase();
const noDb = () => Response.json({ error: "database not configured" }, { status: 503 });

export async function GET(req: Request) {
  if (!isDbConfigured()) return noDb();
  const owner = new URL(req.url).searchParams.get("owner");
  if (!owner || !isAddress(owner)) return Response.json({ error: "valid owner required" }, { status: 400 });
  await ensureSchema();
  const rows = await getSql()`
    select friend_address as address, nickname
    from friends where owner_address = ${lc(owner)}
    order by created_at`;
  return Response.json(rows);
}

export async function POST(req: Request) {
  if (!isDbConfigured()) return noDb();
  const { owner, address, nickname } = (await req.json()) as {
    owner?: string;
    address?: string;
    nickname?: string;
  };
  if (!owner || !isAddress(owner) || !address || !isAddress(address)) {
    return Response.json({ error: "valid owner and address required" }, { status: 400 });
  }
  await ensureSchema();
  await getSql()`
    insert into friends (owner_address, friend_address, nickname)
    values (${lc(owner)}, ${lc(address)}, ${(nickname ?? "").slice(0, 60)})
    on conflict (owner_address, friend_address) do update set nickname = excluded.nickname`;
  return Response.json({ ok: true });
}

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
