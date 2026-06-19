// Chain + contract wiring for the on-chain SavingsVaults.
//
// The target chain is chosen at build time via NEXT_PUBLIC_CHAIN: "anvil" (the
// default — local Foundry dev chain, fake money, zero risk), "celoSepolia" (the
// Celo Sepolia testnet deployment), or "celo" (Celo mainnet — real funds).
// Nothing else in the app needs to know which chain is active; it reads
// activeChain / ACTIVE_RPC / CONTRACTS from here.

import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  custom,
  defineChain,
  formatUnits,
  http,
  type Address,
  type Chain,
} from "viem";
import { celo, celoSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// The local Foundry chain. id 31337 is Anvil's default.
export const anvil = defineChain({
  id: 31337,
  name: "Anvil (local)",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://localhost:8545"] } },
});

// A local Anvil node FORKING Celo mainnet (`anvil --fork-url forno.celo.org
// --chain-id 31337`). It carries real Aave + USDC, so it's the only local way to
// exercise the earning vaults. Same id as anvil (31337) on purpose, so isLocalChain
// stays true and the dev wallet / time-travel keep working. Port-overridable.
export const celoFork = defineChain({
  id: 31337,
  name: "Celo fork (local)",
  nativeCurrency: { name: "Celo", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_FORK_RPC ?? "http://127.0.0.1:8545"] } },
});

type ChainKey = "anvil" | "celoSepolia" | "celo" | "celoFork";

type ChainEntry = {
  chain: Chain;
  contracts: {
    savingsVaults: Address;
    sharedVaults: Address;
    // The Aave-yield (v3) variants. "0x" on chains without an Aave deployment
    // (Anvil, Celo Sepolia) — the create-flow yield toggle is grayed there.
    yieldSavingsVaults: Address;
    yieldSharedVaults: Address;
    token: Address;
  };
  // Whether Aave-backed "earning" vaults work here. True only where Aave V3 lives
  // (Celo mainnet, or an `anvil --fork-url forno.celo.org` dev node). On testnets
  // the toggle is shown but disabled, so the option is visibly wired pre-mainnet.
  yieldAvailable: boolean;
  decimals: number; // the vault token's decimals
  feeCurrency?: Address; // CIP-64 fee-currency to pay gas in (so users need no CELO)
  // The stub friends' addresses (keyholders), per TEST chain. On Anvil these are the
  // well-known test accounts (public keys, signed client-side); on Celo Sepolia
  // they're dedicated wallets whose keys live server-only (signed via /api/dev).
  // OMITTED on mainnet — there real keyholders sign from their own wallets, and the
  // dev approve-as route is gated off (see isTestEnv).
  friends?: { ana: Address; luis: Address };
  // The token the daily raffle prize is paid in (P3). Conceptually COPm; on Anvil
  // the mock token stands in (same 18 decimals as COPm), on testnet a faucetable
  // stand-in. `decimals` MUST match the token so a "4000 COPm" prize scales right.
  prize: { token: Address; decimals: number };
};

const CHAIN_CONFIG: Record<ChainKey, ChainEntry> = {
  anvil: {
    chain: anvil,
    // DETERMINISTIC local addresses — re-running Deploy.s.sol on a fresh Anvil
    // always yields these (deployer account + nonce).
    contracts: {
      savingsVaults: "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0",
      sharedVaults: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9", // local nonce 3 (Deploy.s.sol)
      // No Aave on plain Anvil → no earning vaults. Use a fork node for those.
      yieldSavingsVaults: "0x",
      yieldSharedVaults: "0x",
      token: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    },
    yieldAvailable: false,
    decimals: 18, // MockERC20
    friends: {
      ana: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Anvil acct 1
      luis: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Anvil acct 2
    },
    // Local: the mock token stands in for COPm (both 18 decimals).
    prize: { token: "0x5FbDB2315678afecb367f032d93F642f64180aa3", decimals: 18 },
  },
  celoSepolia: {
    chain: celoSepolia,
    contracts: {
      // Our SavingsVaults deploy output — set via env after deploying; "0x" until
      // then so writes fail fast rather than hit a wrong address.
      savingsVaults: (process.env.NEXT_PUBLIC_SAVINGS_VAULTS_ADDRESS ?? "0x") as Address,
      // Deployed + verified SharedVaults on Celo Sepolia (env-overridable).
      sharedVaults: (process.env.NEXT_PUBLIC_SHARED_VAULTS_ADDRESS ??
        "0xFA72C790C970F2bB76994E6a88219B4F420433e9") as Address,
      // No Aave on Celo Sepolia → earning vaults are unavailable here (toggle grayed).
      yieldSavingsVaults: "0x",
      yieldSharedVaults: "0x",
      // USDC on Celo Sepolia — chosen for testnet because it's directly faucetable
      // (faucet.circle.com), unlike Mento USDm whose Sepolia pools are drained. A
      // first-class MiniPay stablecoin. The mainnet token is a separate, deliberate
      // choice (likely USDm/cUSD or USDT) — testnet token does not commit it.
      token: "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
    },
    yieldAvailable: false,
    decimals: 6, // USDC
    // USDC's CIP-64 fee-currency adapter (6→18) — verified via FeeCurrencyDirectory.
    // Pass as feeCurrency so gas is paid in USDC and the user needs no CELO.
    feeCurrency: "0xbf1441Ea57f43f35f713431001f35742c88071c7",
    friends: {
      // Dedicated testnet wallets (keys are server-only: ANA_PK/LUIS_PK in env).
      ana: "0xf84658EE8704269e863e9CF28dD38D4007dd2080",
      luis: "0xe092eF39dcd29016F07f5D3fA283f9456Ba9a7C2",
    },
    // Testnet stand-in: pay the prize in USDC (faucetable, 6 decimals). Mainnet
    // would use COPm (18 decimals) — override via PRIZE_TOKEN_ADDRESS/_DECIMALS.
    prize: { token: "0x01C5C0122039549AD1493B8220cABEdD739BC44E", decimals: 6 },
  },
  celo: {
    chain: celo,
    contracts: {
      // Mainnet deploy output — set via env AFTER deploying. "0x" until then, with
      // NO baked-in default: on a real-funds chain a wrong fallback address must
      // never be silent, so an unset env fails the write fast instead.
      savingsVaults: (process.env.NEXT_PUBLIC_SAVINGS_VAULTS_ADDRESS ?? "0x") as Address,
      sharedVaults: (process.env.NEXT_PUBLIC_SHARED_VAULTS_ADDRESS ?? "0x") as Address,
      // v3 yield contracts — set via env once they're deployed to mainnet. "0x" (no
      // baked default) until then; yieldAvailable stays false so the toggle is grayed.
      yieldSavingsVaults: (process.env.NEXT_PUBLIC_YIELD_SAVINGS_VAULTS_ADDRESS ?? "0x") as Address,
      yieldSharedVaults: (process.env.NEXT_PUBLIC_YIELD_SHARED_VAULTS_ADDRESS ?? "0x") as Address,
      // Canonical Circle USDC on Celo mainnet (6-dec). Verified against Celo docs /
      // celopedia network-info. Launch is USDC-only (Mento auto-swap deferred).
      token: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    },
    // Aave V3 IS on Celo mainnet, but flip this true only after the v3 yield
    // contracts are actually deployed here and the addresses above are set.
    yieldAvailable: false,
    decimals: 6, // USDC
    // USDC's CIP-64 fee-currency ADAPTER on mainnet (6→18) — NOT the token address
    // (passing the token would revert). Lets gas be paid in USDC so a MiniPay user
    // needs no CELO. Verified via FeeCurrencyDirectory / celopedia network-info.
    feeCurrency: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B",
    // No `friends` on mainnet — keyholders are real users signing from their own
    // wallets; the testnet dev approve-as route is gated off (isTestEnv).
    // Mainnet prize is the REAL COPm (Mento Colombian Peso, 18 decimals) — distinct
    // from the USDC vault token above. Overridable via PRIZE_TOKEN_ADDRESS/_DECIMALS.
    prize: { token: "0x8A567e2aE79CA692Bd748aB832081C45de4041eA", decimals: 18 },
  },
  // Local Celo-mainnet fork: real Aave + USDC, fake gas. The only local chain where
  // earning vaults work. Contract addresses default to the deterministic fresh-fork
  // deploy (contracts/script/dev-fork.sh) and are env-overridable. Dev wallet + the
  // Anvil keyholder accounts work because the id is 31337 (isLocalChain).
  celoFork: {
    chain: celoFork,
    contracts: {
      savingsVaults: (process.env.NEXT_PUBLIC_FORK_SAVINGS ??
        "0xe1Fd27F4390DcBE165f4D60DBF821e4B9Bb02dEd") as Address,
      sharedVaults: (process.env.NEXT_PUBLIC_FORK_SHARED ??
        "0xc582Bc0317dbb0908203541971a358c44b1F3766") as Address,
      yieldSavingsVaults: (process.env.NEXT_PUBLIC_FORK_YIELD_SAVINGS ??
        "0xB2b580ce436E6F77A5713D80887e14788Ef49c9A") as Address,
      yieldSharedVaults: (process.env.NEXT_PUBLIC_FORK_YIELD_SHARED ??
        "0xB377a2EeD7566Ac9fCb0BA673604F9BF875e2Bab") as Address,
      // Real Celo-mainnet USDC (forked in).
      token: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    },
    yieldAvailable: true,
    decimals: 6, // USDC
    friends: {
      // Anvil's well-known accounts #1 and #2 (present on the fork), reused as the
      // stub keyholders so the friend-approves-unlock flow can be driven locally.
      ana: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      luis: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    },
    // Real mainnet COPm (forked in), to mirror mainnet's prize semantics locally.
    prize: { token: "0x8A567e2aE79CA692Bd748aB832081C45de4041eA", decimals: 18 },
  },
};

const CHAIN_KEY: ChainKey =
  process.env.NEXT_PUBLIC_CHAIN === "celo"
    ? "celo"
    : process.env.NEXT_PUBLIC_CHAIN === "celoSepolia"
      ? "celoSepolia"
      : process.env.NEXT_PUBLIC_CHAIN === "celoFork"
        ? "celoFork"
        : "anvil";

// The hosted Celo chains (testnet + mainnet) route browser reads through the
// same-origin /api/rpc proxy + a server-only RPC. The local fork (celoFork) reads
// its local node directly, so it is NOT hosted.
const isHostedCelo = CHAIN_KEY === "celoSepolia" || CHAIN_KEY === "celo";

export const activeChain = CHAIN_CONFIG[CHAIN_KEY].chain;
// In the browser on a Celo chain, reads go through our same-origin /api/rpc proxy,
// which forwards to a dedicated RPC (Alchemy) using a SERVER-ONLY key — so the key
// is never bundled client-side. On the server / Node and on Anvil, use the direct
// RPC (CELO_MAINNET_RPC / CELO_SEPOLIA_RPC server env, else the chain default).
const SERVER_RPC =
  (CHAIN_KEY === "celo" && process.env.CELO_MAINNET_RPC) ||
  (CHAIN_KEY === "celoSepolia" && process.env.CELO_SEPOLIA_RPC) ||
  activeChain.rpcUrls.default.http[0];
export const ACTIVE_RPC =
  isHostedCelo && typeof window !== "undefined"
    ? `${window.location.origin}/api/rpc`
    : SERVER_RPC;
export const CONTRACTS = CHAIN_CONFIG[CHAIN_KEY].contracts;
// Whether Aave-backed "earning" vaults are usable on the active chain. The create
// flow shows the yield toggle either way, but disables it (grayed) when false.
export const YIELD_AVAILABLE = CHAIN_CONFIG[CHAIN_KEY].yieldAvailable;
// The stub friends' keyholder addresses for the active chain.
export const FRIEND_ADDRESSES = CHAIN_CONFIG[CHAIN_KEY].friends;

// The vault token's decimals (Anvil mock = 18, Celo Sepolia USDC = 6). The
// human-USD <-> base-unit conversion uses this.
export const TOKEN_DECIMALS = CHAIN_CONFIG[CHAIN_KEY].decimals;

// Canonical wei -> human USD for the vault token. One seam so the conversion
// (and any future rounding) is identical everywhere (lib/vaults, raffle reads).
export function toUsd(wei: bigint): number {
  return Number(formatUnits(wei, TOKEN_DECIMALS));
}

// Canonical wei -> human COP for the prize token (COPm ≈ 1 COP). The prize is
// shown as a plain COP amount, the way the vault token is shown as USD.
export function toCop(wei: bigint): number {
  return Number(formatUnits(wei, PRIZE_TOKEN_DECIMALS));
}

// The raffle prize token (P3). Per-chain default, overridable via env so a future
// mainnet deploy can point at COPm without a code change.
export const PRIZE_TOKEN = (process.env.PRIZE_TOKEN_ADDRESS ??
  CHAIN_CONFIG[CHAIN_KEY].prize.token) as Address;
export const PRIZE_TOKEN_DECIMALS = Number(
  process.env.PRIZE_TOKEN_DECIMALS ?? CHAIN_CONFIG[CHAIN_KEY].prize.decimals,
);

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

// True only on the local Anvil chain — gates affordances that need a dev node
// (time travel via evm_increaseTime).
export const isLocalChain = activeChain.id === anvil.id;

// True in any non-production test environment (local Anvil OR Celo Sepolia testnet)
// — gates dev affordances that are fine on a testnet, like "approve as keyholder".
export const isTestEnv = isLocalChain || activeChain.id === celoSepolia.id;

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

// Gas options spread into writeContract calls. On Celo we set feeCurrency to the
// token's CIP-64 adapter so gas is paid in the stablecoin (USDC) — a MiniPay user
// holds no CELO. Empty on Anvil (native gas).
const _feeCurrency = CHAIN_CONFIG[CHAIN_KEY].feeCurrency;
export const FEE_OPTS: { feeCurrency?: Address } = _feeCurrency
  ? { feeCurrency: _feeCurrency }
  : {};

// --- PRIZE WALLET (P3 payout) ----------------------------------------------
// The hot wallet that holds and sends the raffle prize. Its key is SERVER-ONLY
// (PRIZE_WALLET_PK) and used only inside the authenticated payout route — never
// the browser. On Anvil it defaults to a well-known test account (#3) so local
// payout works with no config; on a live chain PRIZE_WALLET_PK MUST be set.
const ANVIL_PRIZE_KEY =
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" as const; // Anvil acct 3

function prizeWalletKey(): `0x${string}` {
  const pk = (process.env.PRIZE_WALLET_PK || (isLocalChain ? ANVIL_PRIZE_KEY : "")) as `0x${string}`;
  if (!pk) throw new Error("PRIZE_WALLET_PK not set (required to pay the prize on a live chain)");
  return pk;
}

/**
 * The prize wallet ADDRESS — for read-only checks (e.g. is the prize funded?)
 * without constructing a signer. Prefers the public PRIZE_WALLET_ADDRESS env so a
 * read path needs no spending key at all; falls back to deriving it from the key.
 */
export function getPrizeWalletAddress(): Address {
  if (process.env.PRIZE_WALLET_ADDRESS) return process.env.PRIZE_WALLET_ADDRESS as Address;
  return privateKeyToAccount(prizeWalletKey()).address;
}

/** The prize wallet SIGNER — only the payout route should call this (it spends). */
export function getPrizeWalletClient() {
  return createWalletClient({
    account: privateKeyToAccount(prizeWalletKey()),
    chain: activeChain,
    transport: http(ACTIVE_RPC),
  });
}
