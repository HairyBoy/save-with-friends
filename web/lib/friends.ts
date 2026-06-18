// The social graph: friendships (edges) + identity (self-chosen display names).
//
// NO crypto address is ever shown or typed. You set your OWN name once; everyone is
// shown by the name they set. You add friends only via an invite link (the friend's
// address is captured silently when they open it and their wallet connects). Backed
// by the synced DB (/api/friends, /api/users, /api/invite); addresses stay internal
// (DB keys + on-chain keyholders).

import { getAddress, type Address } from "viem";
import { getActiveAccount } from "@/lib/chains";

export type Friend = { id: string; name: string; address: Address };
export type InviteInfo = { inviterName: string | null; vaultId: string | null; expired: boolean };

function owner(): string | null {
  const a = getActiveAccount();
  return a ? a.toLowerCase() : null;
}

/** The connected user's friends (synced), each shown by their self-chosen name. */
export async function getFriends(): Promise<Friend[]> {
  const me = owner();
  if (!me) return [];
  const res = await fetch(`/api/friends?owner=${me}`);
  if (!res.ok) return [];
  const rows = (await res.json()) as { address: string; name: string | null }[];
  return rows.map((r) => ({ id: r.address.toLowerCase(), name: r.name ?? "", address: getAddress(r.address) }));
}

/** Remove a friend from your list. */
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

/** Resolve display names for a set of addresses (e.g. keyholders). Lowercased keys. */
export async function resolveNames(addresses: string[]): Promise<Record<string, string>> {
  const uniq = [...new Set(addresses.map((a) => a.toLowerCase()))];
  if (uniq.length === 0) return {};
  const res = await fetch(`/api/users?addresses=${uniq.join(",")}`);
  if (!res.ok) return {};
  return (await res.json()) as Record<string, string>;
}

/** Your own display name (null if you haven't set one yet). */
export async function getMyName(): Promise<string | null> {
  const me = owner();
  if (!me) return null;
  const names = await resolveNames([me]);
  return names[me] ?? null;
}

/** Set your own display name (used everywhere you appear). */
export async function setMyName(name: string): Promise<void> {
  const me = owner();
  if (!me) throw new Error("no-wallet");
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: me, displayName: name }),
  });
  if (!res.ok) throw new Error("set-name-failed");
}

/** Mint a shareable invite link. Throws "set-your-name-first" if your name is unset,
 *  "no-wallet" if not connected. `vaultId` is for the future per-vault join. */
export async function mintInvite(vaultId?: string): Promise<string> {
  const me = owner();
  if (!me) throw new Error("no-wallet");
  const res = await fetch("/api/invite", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ inviter: me, vaultId }),
  });
  if (res.status === 409) throw new Error("set-your-name-first");
  if (!res.ok) throw new Error("invite-failed");
  const { token } = (await res.json()) as { token: string };
  return `${window.location.origin}/invite/${token}`;
}

/** Read an invite (for the accept screen). */
export async function getInvite(token: string): Promise<InviteInfo | null> {
  const res = await fetch(`/api/invite/${token}`);
  if (!res.ok) return null;
  return (await res.json()) as InviteInfo;
}

/** Accept a friend invite: set your name (if given) + create the mutual friendship.
 *  (Named distinctly from the shared-vault acceptInvite in lib/vaults.) */
export async function acceptFriendInvite(token: string, myName: string): Promise<void> {
  const me = owner();
  if (!me) throw new Error("no-wallet");
  const res = await fetch(`/api/invite/${token}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ invitee: me, inviteeName: myName }),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(e.error ?? "accept-failed");
  }
}
