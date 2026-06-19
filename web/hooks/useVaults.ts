"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import {
  getBalances,
  getDailyPrize,
  getFriends,
  getMyName,
  setMyName,
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
import {
  getSharedVaults,
  getSharedVault,
  getSharedUnlocked,
  getDraft,
  type SharedVault,
  type Draft,
} from "@/lib/sharedVaults";

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
    copm: number;
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

/** The user's friends (the social graph), for the Friends + Create screens. Friends
 *  are added via invite links (not here); `remove` drops one from your list. */
export function useFriends() {
  const { address } = useWallet();
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    getFriends().then((f) => {
      if (active) setFriends(f);
    });
    return () => {
      active = false;
    };
  }, [address, nonce]);

  const remove = useCallback(async (id: string) => {
    setFriends(await removeFriend(id));
  }, []);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { friends: friends ?? [], isLoading: friends === null, remove, reload };
}

/** Your own display name (the identity everyone sees). `save` sets it; null = unset. */
export function useMyName() {
  const { address } = useWallet();
  const [state, setState] = useState<{ name: string | null; isLoading: boolean }>({
    name: null,
    isLoading: true,
  });

  useEffect(() => {
    let active = true;
    getMyName().then((n) => {
      if (active) setState({ name: n, isLoading: false });
    });
    return () => {
      active = false;
    };
  }, [address]);

  const save = useCallback(async (next: string) => {
    await setMyName(next);
    setState((s) => ({ ...s, name: next.trim() }));
  }, []);

  return { name: state.name, isLoading: state.isLoading, save };
}

/** Shared (group) vaults the user is a member of — for the home list. */
export function useSharedVaults() {
  const { address } = useWallet();
  const [vaults, setVaults] = useState<SharedVault[] | null>(null);

  useEffect(() => {
    let active = true;
    getSharedVaults().then((v) => {
      if (active) setVaults(v);
    });
    return () => {
      active = false;
    };
  }, [address]);

  return { sharedVaults: vaults ?? [], isLoading: vaults === null };
}

/** One shared vault (+ its live unlock state), for the detail screen. */
export function useSharedVault(id: string) {
  const { address } = useWallet();
  const [state, setState] = useState<{ vault: SharedVault | null; unlocked: boolean; isLoading: boolean }>({
    vault: null,
    unlocked: false,
    isLoading: true,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([getSharedVault(id), getSharedUnlocked(id)]).then(([vault, unlocked]) => {
      if (active) setState({ vault, unlocked, isLoading: false });
    });
    return () => {
      active = false;
    };
  }, [id, nonce, address]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

/** A shared-vault DRAFT (assembly stage). `draft` is undefined while loading, null
 *  if not found. `reload()` refetches the roster after a join/remove. */
export function useDraft(draftId: string) {
  const { address } = useWallet();
  const [draft, setDraft] = useState<Draft | null | undefined>(undefined);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    getDraft(draftId).then((d) => {
      if (active) setDraft(d);
    });
    return () => {
      active = false;
    };
  }, [draftId, nonce, address]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { draft, isLoading: draft === undefined, reload };
}

/** Today's prize + this user's odds, for the Prize screen. Refetches when the
 *  wallet connects (the address feeds "your entries"). */
export function useDailyPrize() {
  const { address } = useWallet();
  const [prize, setPrize] = useState<DailyPrize | null>(null);

  useEffect(() => {
    let active = true;
    getDailyPrize().then((p) => {
      if (active) setPrize(p);
    });
    return () => {
      active = false;
    };
  }, [address]);

  return { prize, isLoading: prize === null };
}
