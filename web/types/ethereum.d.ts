import type { EIP1193Provider } from "viem";

declare global {
  interface Window {
    // MiniPay injects an EIP-1193 provider and sets `isMiniPay = true`.
    ethereum?: EIP1193Provider & { isMiniPay?: boolean };
  }
}

export {};
