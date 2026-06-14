// Chain + contract wiring for the on-chain SavingsVaults.
//
// For now this targets a LOCAL Anvil node (the Foundry dev chain) so the whole
// app can be developed against the real contract with fake money and zero risk.
// Celo Sepolia / mainnet get added here later (a second entry + a switch on an
// env var); nothing else in the app needs to know which chain is active.

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// The local Foundry chain. id 31337 is Anvil's default.
export const anvil = defineChain({
  id: 31337,
  name: "Anvil (local)",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://localhost:8545"] } },
});

// The chain the app talks to right now. Swap/branch this when Celo is wired.
export const activeChain = anvil;
export const ACTIVE_RPC = anvil.rpcUrls.default.http[0];

// Deployed addresses on a fresh Anvil. These are DETERMINISTIC — they come from
// the deployer account + nonce in contracts/script/Deploy.s.sol, so re-running
// the deploy on a clean Anvil always yields these same two addresses.
export const CONTRACTS = {
  savingsVaults: "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0" as Address,
  // Mock cUSD stand-in (on Celo this becomes the real USDm address from lib/tokens).
  token: "0x5FbDB2315678afecb367f032d93F642f64180aa3" as Address,
} as const;

// The vault token is 18-decimal (the mock matches USDm/cUSD). One place to change
// if the canonical token's decimals ever differ.
export const TOKEN_DECIMALS = 18;

// A read-only client. Safe everywhere (no wallet, no signing).
export function getPublicClient() {
  return createPublicClient({ chain: activeChain, transport: http(ACTIVE_RPC) });
}

// --- DEV-ONLY wallet -------------------------------------------------------
// In production the wallet is MiniPay's injected provider (see useMiniPay). But
// in local dev there's no injected wallet, so to SEND transactions we act as
// Anvil's account #0 — the deployer, which holds 1,000,000 mock tokens. This is
// Anvil's well-known, publicly-documented test key; it controls nothing real and
// must never be used against a live chain. Guarded to the local chain below.
const ANVIL_ACCOUNT_0_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

export const devAccount = privateKeyToAccount(ANVIL_ACCOUNT_0_KEY);

export function getDevWalletClient() {
  if (activeChain.id !== anvil.id) {
    throw new Error("dev wallet is local-only; a real wallet must sign on a live chain");
  }
  return createWalletClient({
    account: devAccount,
    chain: activeChain,
    transport: http(ACTIVE_RPC),
  });
}
