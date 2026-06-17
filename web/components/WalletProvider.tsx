"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { connectWallet, isMiniPay as detectMiniPay } from "@/lib/chains";

// Wallet connection state, app-wide. On local Anvil this resolves to the dev
// account immediately; on Celo it zero-click connects to the injected MiniPay
// wallet. Data hooks depend on `address` so they refetch once it's known.
type WalletState = {
  address: `0x${string}` | null;
  isConnected: boolean;
  isMiniPay: boolean;
  isConnecting: boolean;
};

const WalletContext = createContext<WalletState>({
  address: null,
  isConnected: false,
  isMiniPay: false,
  isConnecting: true,
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({
    address: null,
    isConnected: false,
    isMiniPay: false,
    isConnecting: true,
  });

  useEffect(() => {
    let active = true;
    connectWallet()
      .then((addr) => {
        if (!active) return;
        setState({
          address: addr,
          isConnected: addr !== null,
          isMiniPay: detectMiniPay(),
          isConnecting: false,
        });
      })
      .catch(() => {
        if (active) setState((s) => ({ ...s, isConnecting: false }));
      });
    return () => {
      active = false;
    };
  }, []);

  return <WalletContext.Provider value={state}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  return useContext(WalletContext);
}
