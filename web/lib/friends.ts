// The user's friends list — the people they can pick as keyholders on a vault.
//
// PHASE 1: localStorage-backed, per-device, no backend and no auth. A friend is
// just a wallet address + a nickname you give them. Picking a friend as a
// keyholder writes their REAL on-chain address into the vault; that friend then
// approves an early unlock from their OWN wallet (no custody, no server signing).
// Phase 2 moves this list to a synced backend (Neon) so it follows you across
// devices — until then it's the one piece of social state that lives on-device.

import { getAddress, isAddress, type Address } from "viem";
import { FRIEND_ADDRESSES, isLocalChain } from "@/lib/chains";

export type Friend = { id: string; name: string; address: Address };

const STORE_KEY = "friends:v1";

// Built-in display names for the per-chain seed wallets, so a vault whose
// keyholders are those wallets still renders a friendly name even if the user
// hasn't added them to their list. Display only — never used for signing.
const SEED_FRIENDS: Friend[] = [
  { id: FRIEND_ADDRESSES.ana.toLowerCase(), name: "Ana", address: FRIEND_ADDRESSES.ana },
  { id: FRIEND_ADDRESSES.luis.toLowerCase(), name: "Luis", address: FRIEND_ADDRESSES.luis },
];

function read(): Friend[] | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Friend[];
  } catch {
    return null;
  }
}

function write(friends: Friend[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORE_KEY, JSON.stringify(friends));
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * The user's friends (per-device). On the local Anvil chain we seed the
 * well-known test accounts on first use, so the create picker + the
 * friend-approves-unlock flow work out of the box; on testnet/prod the list
 * starts empty and you add real friends by address.
 */
export function getStoredFriends(): Friend[] {
  const stored = read();
  if (stored) return stored;
  const seed = isLocalChain ? SEED_FRIENDS : [];
  write(seed);
  return seed;
}

/**
 * Add a friend by wallet address (+ a nickname). Idempotent on the address
 * (re-adding updates the nickname). Returns the new list. Throws "invalid-address"
 * if the address doesn't parse — the caller validates first for a nicer message.
 */
export function addFriend(name: string, address: string): Friend[] {
  if (!isAddress(address)) throw new Error("invalid-address");
  const checksummed = getAddress(address);
  const id = checksummed.toLowerCase();
  const trimmed = name.trim();
  const others = getStoredFriends().filter((f) => f.id !== id);
  const next = [...others, { id, name: trimmed || shortAddress(checksummed), address: checksummed }];
  write(next);
  return next;
}

/** Remove a friend by id. Returns the new list. */
export function removeFriend(id: string): Friend[] {
  const next = getStoredFriends().filter((f) => f.id !== id);
  write(next);
  return next;
}

/**
 * Display name for an on-chain keyholder address: your nickname if you know them,
 * else the built-in seed name, else a short 0x… form. (Display only.)
 */
export function friendName(address: string): string {
  const lower = address.toLowerCase();
  const known = [...getStoredFriends(), ...SEED_FRIENDS].find((f) => f.id === lower);
  return known?.name ?? shortAddress(address);
}
