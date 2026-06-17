"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import {
  addFriend,
  getBalances,
  getDailyPrize,
  getFriends,
  removeFriend,
  getSavingsSummary,
  getChainNow,
  getVault,
  getVaultKeyholders,
  getVaults,
  getWalletBalance,
  isVaultUnlocked,
  type VaultKeyholder,
  type DailyPrize,
  type Friend,
  type SavingsSummary,
  type Vault,
} from "@/lib/vaults";

/**
 * Home data: the user's vaults + their total saved, fetched together.
 * Stubbed today; async so it survives the swap to real on-chain/backend reads.
 */
export function useSavings() {
  const { address } = useWallet();
  const [data, setData] = useState<{ vaults: Vault[]; summary: SavingsSummary } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getVaults(), getSavingsSummary()]).then(([vaults, summary]) => {
      if (active) setData({ vaults, summary });
    });
    return () => {
      active = false;
    };
  }, [address]);

  return {
    vaults: data?.vaults ?? [],
    summary: data?.summary ?? null,
    isLoading: data === null,
  };
}

/** Spendable wallet balance (USD) — null while loading. `reload()` refetches. */
export function useWalletBalance() {
  const { address } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    getWalletBalance().then((b) => {
      if (active) setBalance(b);
    });
    return () => {
      active = false;
    };
  }, [nonce, address]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { balance, isLoading: balance === null, reload };
}

/** Personal-vault + shared-receiving + wallet + total (USD) — for the Me page. */
export function useBalances() {
  const { address } = useWallet();
  const [balances, setBalances] = useState<{
    personal: number;
    sharedReceiving: number;
    wallet: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    let active = true;
    getBalances().then((b) => {
      if (active) setBalances(b);
    });
    return () => {
      active = false;
    };
  }, [address]);

  return { balances, isLoading: balances === null };
}

/** A single vault by id (+ its live unlock state), for the detail screen.
 *  `reload()` refetches after a deposit/withdraw/time-travel changes the chain. */
export function useVault(id: string) {
  const { address } = useWallet();
  // One state object set once in the async callback (avoids a synchronous
  // setState in the effect, which the react-hooks lint flags as cascading).
  const [state, setState] = useState<{
    vault: Vault | null;
    unlocked: boolean;
    chainNow: number; // chain clock (unix s) — real or simulated; 0 while loading
    keyholders: VaultKeyholder[];
    isLoading: boolean;
  }>({ vault: null, unlocked: false, chainNow: 0, keyholders: [], isLoading: true });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      getVault(id),
      isVaultUnlocked(id),
      getChainNow(),
      getVaultKeyholders(id),
    ]).then(([vault, unlocked, chainNow, keyholders]) => {
      if (active) setState({ vault, unlocked, chainNow, keyholders, isLoading: false });
    });
    return () => {
      active = false;
    };
  }, [id, nonce, address]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

/** The user's friends (the social graph), for the Friends + Create screens.
 *  `add`/`remove` mutate the local list and update in place. `add` throws
 *  "invalid-address" if the address doesn't parse (the caller validates first). */
export function useFriends() {
  const [friends, setFriends] = useState<Friend[] | null>(null);

  useEffect(() => {
    let active = true;
    getFriends().then((f) => {
      if (active) setFriends(f);
    });
    return () => {
      active = false;
    };
  }, []);

  const add = useCallback((name: string, address: string) => {
    setFriends(addFriend(name, address));
  }, []);
  const remove = useCallback((id: string) => {
    setFriends(removeFriend(id));
  }, []);

  return { friends: friends ?? [], isLoading: friends === null, add, remove };
}

/** Today's prize + this user's odds, for the Prize screen. */
export function useDailyPrize() {
  const [prize, setPrize] = useState<DailyPrize | null>(null);

  useEffect(() => {
    let active = true;
    getDailyPrize().then((p) => {
      if (active) setPrize(p);
    });
    return () => {
      active = false;
    };
  }, []);

  return { prize, isLoading: prize === null };
}
