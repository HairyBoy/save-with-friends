// A shared-vault draft: read it (for the assembly + join screens) and act on it —
// join the roster, the owner removes someone, or the owner records the on-chain
// launch. Joining a draft also creates the mutual friendship (like accepting an
// invite). Names live in `users`; no addresses are surfaced.
import { isAddress } from "viem";
import { CONTRACTS, getPublicClient } from "@/lib/chains";
import { sharedVaultsAbi } from "@/lib/sharedVaultsAbi";
import { yieldSharedVaultsAbi } from "@/lib/yieldSharedVaultsAbi";
import { ensureSchema, getSql, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

const noDb = () => Response.json({ error: "database not configured" }, { status: 503 });
const lc = (a: string) => a.toLowerCase();

// A launched vault id is namespaced: "y"-prefixed for the Aave-yield contract, a bare
// number for the plain one. Recover which contract to verify against.
function parseVaultId(vaultId: string): { yield: boolean; num: bigint } {
  return vaultId.startsWith("y")
    ? { yield: true, num: BigInt(vaultId.slice(1)) }
    : { yield: false, num: BigInt(vaultId) };
}

type Draft = {
  owner_address: string;
  name: string;
  icon: string;
  goal: string;
  deadline_days: number;
  payout: number;
  earn: boolean;
  launched_vault_id: string | null;
};

async function loadDraft(id: string): Promise<Draft | undefined> {
  const [d] = (await getSql()`
    select owner_address, name, icon, goal, deadline_days, payout, earn, launched_vault_id
    from vault_drafts where id = ${id}`) as Draft[];
  return d;
}

// GET → draft details + roster (names from users). For the assembly + join screens.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!isDbConfigured()) return noDb();
  const { token } = await params;
  await ensureSchema();
  const sql = getSql();
  const d = await loadDraft(token);
  if (!d) return Response.json({ error: "not-found" }, { status: 404 });
  const [ownerRow] = (await sql`select display_name from users where address = ${d.owner_address}`) as {
    display_name: string;
  }[];
  const members = await sql`
    select dm.member_address as address, u.display_name as name
    from draft_members dm left join users u on u.address = dm.member_address
    where dm.draft_id = ${token} order by dm.created_at`;
  return Response.json({
    owner: d.owner_address,
    ownerName: ownerRow?.display_name ?? null,
    name: d.name,
    icon: d.icon,
    goal: d.goal,
    deadlineDays: d.deadline_days,
    payout: d.payout,
    earn: d.earn,
    launchedVaultId: d.launched_vault_id,
    members,
  });
}

// POST { action: "join" | "remove" | "launch", ... }
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!isDbConfigured()) return noDb();
  const { token } = await params;
  const body = (await req.json()) as {
    action?: string;
    member?: string;
    memberName?: string;
    owner?: string;
    vaultId?: string | number;
  };
  await ensureSchema();
  const sql = getSql();
  const d = await loadDraft(token);
  if (!d) return Response.json({ error: "not-found" }, { status: 404 });

  if (body.action === "join") {
    if (d.launched_vault_id) return Response.json({ error: "already-launched" }, { status: 410 });
    const member = body.member;
    if (!member || !isAddress(member)) return Response.json({ error: "valid member required" }, { status: 400 });
    if (lc(member) === d.owner_address) return Response.json({ error: "self" }, { status: 400 });
    if (body.memberName?.trim()) {
      await sql`insert into users (address, display_name) values (${lc(member)}, ${body.memberName.trim().slice(0, 40)})
        on conflict (address) do update set display_name = excluded.display_name, updated_at = now()`;
    }
    await sql`insert into draft_members (draft_id, member_address) values (${token}, ${lc(member)}) on conflict do nothing`;
    // Joining a draft also befriends the owner (mutual), like accepting an invite.
    await sql`insert into friends (owner_address, friend_address) values (${d.owner_address}, ${lc(member)}) on conflict do nothing`;
    await sql`insert into friends (owner_address, friend_address) values (${lc(member)}, ${d.owner_address}) on conflict do nothing`;
    return Response.json({ ok: true });
  }

  if (body.action === "remove") {
    if (!body.owner || lc(body.owner) !== d.owner_address) return Response.json({ error: "owner only" }, { status: 403 });
    if (!body.member || lc(body.member) === d.owner_address) return Response.json({ error: "cannot remove owner" }, { status: 400 });
    await sql`delete from draft_members where draft_id = ${token} and member_address = ${lc(body.member)}`;
    return Response.json({ ok: true });
  }

  if (body.action === "launch") {
    if (!body.owner || lc(body.owner) !== d.owner_address) return Response.json({ error: "owner only" }, { status: 403 });
    if (body.vaultId == null) return Response.json({ error: "vaultId required" }, { status: 400 });
    // Verify on-chain that the launched vault is really owned by this owner. The id is
    // namespaced, so read against the matching contract (plain vs Aave-yield).
    try {
      const { yield: isYield, num } = parseVaultId(String(body.vaultId));
      const v = await getPublicClient().readContract({
        address: isYield ? CONTRACTS.yieldSharedVaults : CONTRACTS.sharedVaults,
        abi: isYield ? (yieldSharedVaultsAbi as unknown as typeof sharedVaultsAbi) : sharedVaultsAbi,
        functionName: "getVault",
        args: [num],
      });
      if (v.owner.toLowerCase() !== d.owner_address) {
        return Response.json({ error: "not the vault owner" }, { status: 403 });
      }
    } catch {
      return Response.json({ error: "could not verify vault owner on-chain" }, { status: 400 });
    }
    await sql`update vault_drafts set launched_vault_id = ${String(body.vaultId)} where id = ${token}`;
    return Response.json({ ok: true });
  }

  return Response.json({ error: "unknown action" }, { status: 400 });
}
