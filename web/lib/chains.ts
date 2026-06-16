// Chain + contract wiring for the on-chain SavingsVaults.
//
// The target chain is chosen at build time via NEXT_PUBLIC_CHAIN: "anvil" (the
// default — local Foundry dev chain, fake money, zero risk) or "celoSepolia"
// (the Celo Sepolia testnet deployment). Nothing else in the app needs to know
// which chain is active; it reads activeChain / ACTIVE_RPC / CONTRACTS from here.

import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  type Address,
  type Chain,
} from "viem";
import { celoSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// The local Foundry chain. id 31337 is Anvil's default.
export const anvil = defineChain({
  id: 31337,
  name: "Anvil (local)",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://localhost:8545"] } },
});

type ChainKey = "anvil" | "celoSepolia";

type ChainEntry = {
  chain: Chain;
  contracts: { savingsVaults: Address; token: Address };
  decimals: number; // the vault token's decimals
};

const CHAIN_CONFIG: Record<ChainKey, ChainEntry> = {
  anvil: {
    chain: anvil,
    // DETERMINISTIC local addresses — re-running Deploy.s.sol on a fresh Anvil
    // always yields these (deployer account + nonce).
    contracts: {
      savingsVaults: "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0",
      token: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    },
    decimals: 18, // MockERC20
  },
  celoSepolia: {
    chain: celoSepolia,
    contracts: {
      // Our SavingsVaults deploy output — set via env after deploying; "0x" until
      // then so writes fail fast rather than hit a wrong address.
      savingsVaults: (process.env.NEXT_PUBLIC_SAVINGS_VAULTS_ADDRESS ?? "0x") as Address,
      // USDC on Celo Sepolia — chosen for testnet because it's directly faucetable
      // (faucet.circle.com), unlike Mento USDm whose Sepolia pools are drained. A
      // first-class MiniPay stablecoin. The mainnet token is a separate, deliberate
      // choice (likely USDm/cUSD or USDT) — testnet token does not commit it.
      token: "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
    },
    decimals: 6, // USDC
  },
};

const CHAIN_KEY: ChainKey =
  process.env.NEXT_PUBLIC_CHAIN === "celoSepolia" ? "celoSepolia" : "anvil";

export const activeChain = CHAIN_CONFIG[CHAIN_KEY].chain;
export const ACTIVE_RPC = activeChain.rpcUrls.default.http[0];
export const CONTRACTS = CHAIN_CONFIG[CHAIN_KEY].contracts;

// The vault token's decimals (Anvil mock = 18, Celo Sepolia USDC = 6). The
// human-USD <-> base-unit conversion in lib/vaults uses this.
export const TOKEN_DECIMALS = CHAIN_CONFIG[CHAIN_KEY].decimals;

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

// True only on the local Anvil chain — gates dev-only affordances (time travel).
export const isLocalChain = activeChain.id === anvil.id;

// DEV-ONLY: Anvil's other well-known test accounts, used as stand-in keyholder
// wallets so the friend-approves-unlock flow can be driven locally. Account 0 is
// the owner (devAccount above); these are accounts 1 & 2. Public Anvil keys —
// local only, control nothing real, must never touch a live chain.
const ANVIL_KEYHOLDER_KEYS: Record<string, `0x${string}`> = {
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8":
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc":
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
};

// A wallet client that signs AS a given keyholder (their own Anvil test account),
// so a friend can approve an early unlock — the owner can't approve their own.
export function getDevKeyholderWalletClient(keyholder: Address) {
  if (!isLocalChain) {
    throw new Error("keyholder approval is local-only (Anvil test accounts)");
  }
  const key = ANVIL_KEYHOLDER_KEYS[keyholder.toLowerCase()];
  if (!key) throw new Error(`no dev key for keyholder ${keyholder}`);
  return createWalletClient({
    account: privateKeyToAccount(key),
    chain: activeChain,
    transport: http(ACTIVE_RPC),
  });
}

// A test client that can drive Anvil's clock. Local-only: the test RPC methods
// (evm_increaseTime/evm_mine) exist only on a dev node, never on a real chain.
export function getDevTestClient() {
  if (!isLocalChain) {
    throw new Error("time travel is local-only (Anvil test RPC)");
  }
  return createTestClient({ chain: activeChain, mode: "anvil", transport: http(ACTIVE_RPC) });
}

// --- active account + signer (dev wallet locally, injected MiniPay on Celo) ---

// The address the app acts as: locally the dev account; on Celo the connected
// injected (MiniPay) wallet. Module-level so the non-React data layer (lib/vaults)
// can read it synchronously; WalletProvider keeps it in sync with React state.
let activeAccount: Address | null = isLocalChain ? devAccount.address : null;

export function getActiveAccount(): Address | null {
  return activeAccount;
}

function injectedProvider() {
  return typeof window !== "undefined" ? window.ethereum : undefined;
}

/** Whether the injected wallet is MiniPay (drives connect UX / copy). */
export function isMiniPay(): boolean {
  return injectedProvider()?.isMiniPay === true;
}

/**
 * Zero-click connect: locally returns the dev account; on Celo reads the injected
 * (MiniPay) account with no prompt. Sets the module account and returns it (null
 * if there's no injected wallet — e.g. a normal browser tab on testnet).
 */
export async function connectWallet(): Promise<Address | null> {
  if (isLocalChain) {
    activeAccount = devAccount.address;
    return activeAccount;
  }
  const provider = injectedProvider();
  if (!provider) {
    activeAccount = null;
    return null;
  }
  const wallet = createWalletClient({ chain: activeChain, transport: custom(provider) });
  const [addr] = await wallet.getAddresses();
  activeAccount = addr ?? null;
  return activeAccount;
}

/**
 * The signer for writes: the dev wallet locally, or the injected MiniPay wallet on
 * Celo. Throws on Celo if no wallet is connected (no injected provider / account).
 */
export function getWalletClient() {
  if (isLocalChain) return getDevWalletClient();
  const provider = injectedProvider();
  if (!provider || !activeAccount) {
    throw new Error("No wallet connected — open this in MiniPay or a Celo wallet.");
  }
  return createWalletClient({
    account: activeAccount,
    chain: activeChain,
    transport: custom(provider),
  });
}

// Gas options spread into writeContract calls. Left empty for now (pay native
// CELO), because the testnet token is USDC and CIP-64 fee abstraction in USDC
// requires the USDC *adapter* address (6→18), not the token address. TODO: wire
// the Celo USDC fee-currency adapter so users can pay gas in USDC; in real MiniPay
// the wallet handles the fee currency itself regardless.
export const FEE_OPTS: { feeCurrency?: Address } = {};
