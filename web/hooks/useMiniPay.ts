"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  erc20Abi,
  formatUnits,
} from "viem";
import { celo } from "viem/chains";
import { STABLECOINS } from "@/lib/tokens";

export type TokenBalance = {
  symbol: string;
  label: string;
  decimals: number;
  address: `0x${string}`;
  raw: bigint;
  human: number;
};

/**
 * MiniPay-compliant wallet hook:
 *  - Zero-click connect: reads the injected account, never shows a connect button.
 *  - No message signing (MiniPay doesn't support personal_sign / eth_signTypedData).
 *  - Loads balances for every supported stablecoin (incl. COPm).
 */
export function useMiniPay() {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [isMiniPay, setIsMiniPay] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async (user: `0x${string}`) => {
    const publicClient = createPublicClient({ chain: celo, transport: http() });
    const results = await Promise.all(
      STABLECOINS.map(async (t) => {
        const raw = (await publicClient.readContract({
          address: t.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [user],
        })) as bigint;
        return {
          symbol: t.symbol,
          label: t.label,
          decimals: t.decimals,
          address: t.address,
          raw,
          human: Number(formatUnits(raw, t.decimals)),
        };
      })
    );
    setBalances(results);
  }, []);

  useEffect(() => {
    (async () => {
      const provider = typeof window === "undefined" ? undefined : window.ethereum;
      if (!provider) {
        setIsLoading(false);
        return;
      }
      setIsMiniPay(provider.isMiniPay === true);
      try {
        const wallet = createWalletClient({
          chain: celo,
          transport: custom(provider),
        });
        // In MiniPay this returns the user's account with no prompt (zero-click).
        const [addr] = await wallet.getAddresses();
        if (addr) {
          setAddress(addr);
          await refresh(addr);
        }
      } catch {
        // Outside MiniPay or not yet authorized — fall through to fallback UI.
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refresh]);

  return { address, balances, isMiniPay, isLoading, refresh };
}
