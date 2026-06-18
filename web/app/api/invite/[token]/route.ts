// Read an invite (for the accept screen) and accept it (create the mutual
// friendship). Names live in `users`; friendships are pure edges.
import { isAddress } from "viem";
import { ensureSchema, getSql, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

const noDb = () => Response.json({ error: "database not configured" }, { status: 503 });

type Invite = { inviter_address: string; vault_id: string | null; expires_at: string | null };

async function loadInvite(token: string): Promise<Invite | undefined> {
  const [inv] = (await getSql()`
    select inviter_address, vault_id, expires_at from invites where token = ${token}`) as Invite[];
  return inv;
}
const isExpired = (inv: Invite) => Boolean(inv.expires_at && new Date(inv.expires_at) < new Date());

// GET → { inviterName, vaultId, expired } for the accept screen (no address exposed).
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!isDbConfigured()) return noDb();
  const { token } = await params;
  await ensureSchema();
  const inv = await loadInvite(token);
  if (!inv) return Response.json({ error: "not-found" }, { status: 404 });
  const [u] = (await getSql()`
    select display_name from users where address = ${inv.inviter_address}`) as { display_name: string }[];
  return Response.json({
    inviterName: u?.display_name ?? null,
    vaultId: inv.vault_id,
    expired: isExpired(inv),
  });
}

// POST { invitee, inviteeName } → set the invitee's name (if given) + mutual friendship.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!isDbConfigured()) return noDb();
  const { token } = await params;
  const { invitee, inviteeName } = (await req.json()) as { invitee?: string; inviteeName?: string };
  if (!invitee || !isAddress(invitee)) {
    return Response.json({ error: "valid invitee required" }, { status: 400 });
  }
  await ensureSchema();
  const inv = await loadInvite(token);
  if (!inv) return Response.json({ error: "not-found" }, { status: 404 });
  if (isExpired(inv)) return Response.json({ error: "expired" }, { status: 410 });

  const a = inv.inviter_address.toLowerCase();
  const b = invitee.toLowerCase();
  if (a === b) return Response.json({ error: "self" }, { status: 400 });

  const sql = getSql();
  if (inviteeName?.trim()) {
    await sql`
      insert into users (address, display_name) values (${b}, ${inviteeName.trim().slice(0, 40)})
      on conflict (address) do update set display_name = excluded.display_name, updated_at = now()`;
  }
  // Mutual friendship (edges only; names live in users). Idempotent on re-accept.
  await sql`insert into friends (owner_address, friend_address) values (${a}, ${b}) on conflict do nothing`;
  await sql`insert into friends (owner_address, friend_address) values (${b}, ${a}) on conflict do nothing`;
  return Response.json({ ok: true, vaultId: inv.vault_id });
}
