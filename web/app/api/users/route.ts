// User display names — the single source of identity. You set your own name once;
// everywhere you appear (friends list, keyholder, invite) it's resolved by address.
// Addresses are never surfaced to users. Scoped/trusted by the MiniPay-connected
// address (cosmetic data; same model as the rest — see lib/db.ts).
import { isAddress } from "viem";
import { ensureSchema, getSql, isDbConfigured } from "@/lib/db";

const lc = (a: string) => a.toLowerCase();
const noDb = () => Response.json({ error: "database not configured" }, { status: 503 });

// GET /api/users?addresses=0x..,0x.. → { "0x..": "Name", ... } (only ones with a name)
export async function GET(req: Request) {
  if (!isDbConfigured()) return noDb();
  const addrs = (new URL(req.url).searchParams.get("addresses") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => isAddress(s))
    .map(lc);
  if (addrs.length === 0) return Response.json({});
  await ensureSchema();
  const rows = (await getSql()`
    select address, display_name from users where address = any(${addrs})`) as {
    address: string;
    display_name: string;
  }[];
  const out: Record<string, string> = {};
  for (const r of rows) out[r.address] = r.display_name;
  return Response.json(out);
}

// POST { address, displayName } → set your own display name.
export async function POST(req: Request) {
  if (!isDbConfigured()) return noDb();
  const { address, displayName } = (await req.json()) as { address?: string; displayName?: string };
  if (!address || !isAddress(address) || !displayName?.trim()) {
    return Response.json({ error: "address and displayName required" }, { status: 400 });
  }
  await ensureSchema();
  await getSql()`
    insert into users (address, display_name) values (${lc(address)}, ${displayName.trim().slice(0, 40)})
    on conflict (address) do update set display_name = excluded.display_name, updated_at = now()`;
  return Response.json({ ok: true });
}
