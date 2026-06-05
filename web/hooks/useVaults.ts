"use client";

import { useEffect, useState } from "react";
import {
  getFriends,
  getTotalSaved,
  getVault,
  getVaults,
  type Friend,
  type SavingsSummary,
  type Vault,
} from "@/lib/vaults";

/**
 * Home data: the user's vaults + their total saved, fetched together.
 * Stubbed today; async so it survives the swap to real on-chain/backend reads.
 */
export function useSavings() {
  const [data, setData] = useState<{ vaults: Vault[]; summary: SavingsSummary } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getVaults(), getTotalSaved()]).then(([vaults, summary]) => {
      if (active) setData({ vaults, summary });
    });
    return () => {
      active = false;
    };
  }, []);

  return {
    vaults: data?.vaults ?? [],
    summary: data?.summary ?? null,
    isLoading: data === null,
  };
}

/** A single vault by id, for the detail screen. */
export function useVault(id: string) {
  // One state object set once in the async callback (avoids a synchronous
  // setState in the effect, which the react-hooks lint flags as cascading).
  const [state, setState] = useState<{ vault: Vault | null; isLoading: boolean }>({
    vault: null,
    isLoading: true,
  });

  useEffect(() => {
    let active = true;
    getVault(id).then((vault) => {
      if (active) setState({ vault, isLoading: false });
    });
    return () => {
      active = false;
    };
  }, [id]);

  return state;
}

/** The user's friends (the social graph), for the Friends screen. */
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

  return { friends: friends ?? [], isLoading: friends === null };
}
