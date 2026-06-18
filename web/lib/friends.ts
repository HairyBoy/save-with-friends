// The user's friends list — who they can pick as keyholders on a vault.
//
// PHASE 2: backed by the synced DB via /api/friends (was per-device localStorage
// in Phase 1). Scoped to the connected wallet address. A friend is a wallet
// address + a nickname; picking one as a keyholder writes their real on-chain
// address into the vault, and they approve an early unlock from their OWN wallet.

import { getAddress, isAddress, type Address } from "viem";
import { FRIEND_ADDRESSES, getActiveAccount } from "@/lib/chains";

export type Friend = { id: string; name: string; address: Address };

// Built-in display names for the per-chain seed wallets, so a vault whose
// keyholders are those wallets still renders a friendly name even if the user
// hasn't added them. Display only — never used for signing or storage.
const SEED_FRIENDS: Friend[] = [
  { id: FRIEND_ADDRESSES.ana.toLowerCase(), name: "Ana", address: FRIEND_ADDRESSES.ana },
  { id: FRIEND_ADDRESSES.luis.toLowerCase(), name: "Luis", address: FRIEND_ADDRESSES.luis },
];

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function owner(): string | null {
  const a = getActiveAccount();
  return a ? a.toLowerCase() : null;
}

/** The connected user's friends (synced). Empty before a wallet connects. */
export async function getFriends(): Promise<Friend[]> {
  const me = owner();
  if (!me) return [];
  const res = await fetch(`/api/friends?owner=${me}`);
  if (!res.ok) return [];
  const rows = (await res.json()) as { address: string; nickname: string }[];
  return rows.map((r) => ({
    id: r.address.toLowerCase(),
    name: r.nickname || shortAddress(r.address),
    address: getAddress(r.address),
  }));
}

/** Add a friend by wallet address (+ nickname). Returns the refreshed list.
 *  Throws "invalid-address" if the address doesn't parse (caller validates first). */
export async function addFriend(name: string, address: string): Promise<Friend[]> {
  if (!isAddress(address)) throw new Error("invalid-address");
  const me = owner();
  if (!me) throw new Error("no-wallet");
  const res = await fetch("/api/friends", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ owner: me, address: getAddress(address), nickname: name.trim() }),
  });
  if (!res.ok) throw new Error("add-failed");
  return getFriends();
}

/** Remove a friend by id (their lowercased address). Returns the refreshed list. */
export async function removeFriend(id: string): Promise<Friend[]> {
  const me = owner();
  if (!me) return getFriends();
  await fetch("/api/friends", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ owner: me, address: id }),
  });
  return getFriends();
}

/** Display name for an on-chain keyholder address: the viewer's nickname if they
 *  know them, else the built-in seed name, else a short 0x… form. `friends` is the
 *  viewer's already-loaded list (so this stays synchronous for mapping). */
export function friendName(address: string, friends: Friend[]): string {
  const lower = address.toLowerCase();
  const known = [...friends, ...SEED_FRIENDS].find((f) => f.id === lower);
  return known?.name ?? shortAddress(address);
}
