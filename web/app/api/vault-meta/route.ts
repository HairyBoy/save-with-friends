// Vault names + emojis (the contract deliberately doesn't store them). Reads are
// PUBLIC (so a keyholder opening a vault link sees its real name); writes are
// restricted to the vault's on-chain owner — verified against the chain here, so
// a spoofed address can't rename someone else's vault.
import { isAddress } from "viem";
import { CONTRACTS, getPublicClient } from "@/lib/chains";
import { savingsVaultsAbi } from "@/lib/savingsVaultsAbi";
import { ensureSchema, getSql, isDbConfigured } from "@/lib/db";

const noDb = () => Response.json({ error: "database not configured" }, { status: 503 });

export async function GET(req: Request) {
  if (!isDbConfigured()) return noDb();
  const params = new URL(req.url).searchParams;
  const chainId = Number(params.get("chainId"));
  const ids = (params.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!chainId || ids.length === 0) return Response.json([]);
  await ensureSchema();
  const rows = await getSql()`
    select vault_id as id, name, icon, created_at as "createdAt"
    from vault_meta where chain_id = ${chainId} and vault_id = any(${ids})`;
  return Response.json(rows);
}

export async function POST(req: Request) {
  if (!isDbConfigured()) return noDb();
  const { chainId, vaultId, owner, name, icon, createdAt } = (await req.json()) as {
    chainId?: number;
    vaultId?: string | number;
    owner?: string;
    name?: string;
    icon?: string;
    createdAt?: string;
  };
  if (!chainId || vaultId == null || !owner || !isAddress(owner)) {
    return Response.json({ error: "valid chainId, vaultId and owner required" }, { status: 400 });
  }

  // On-chain ownership check: only the vault's actual owner may set its name.
  try {
    const v = await getPublicClient().readContract({
      address: CONTRACTS.savingsVaults,
      abi: savingsVaultsAbi,
      functionName: "getVault",
      args: [BigInt(vaultId)],
    });
    if (v.owner.toLowerCase() !== owner.toLowerCase()) {
      return Response.json({ error: "not the vault owner" }, { status: 403 });
    }
  } catch {
    return Response.json({ error: "could not verify vault owner on-chain" }, { status: 400 });
  }

  await ensureSchema();
  await getSql()`
    insert into vault_meta (chain_id, vault_id, owner_address, name, icon, created_at)
    values (${chainId}, ${String(vaultId)}, ${owner.toLowerCase()}, ${(name ?? "Vault").slice(0, 60)}, ${icon ?? "🔒"}, ${createdAt ?? null})
    on conflict (chain_id, vault_id)
      do update set name = excluded.name, icon = excluded.icon, updated_at = now()`;
  return Response.json({ ok: true });
}
