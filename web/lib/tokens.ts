// Stablecoin registry for "Save with Friends".
//
// We support MiniPay's first-class trio (USDm / USDC / USDT) PLUS COPm, the
// Mento Colombian Peso — per the Celo Colombia hackathon goal. Addresses are
// Celo MAINNET, verified from Celopedia `contracts.md` + MiniPay docs.
//
// IMPORTANT distinctions baked in here:
//  - `address`     → use for balances, transfers, approvals.
//  - `feeCurrency` → use ONLY in the tx `feeCurrency` field (pay network fee in
//                    stablecoin). USDm is 18-decimal so token == adapter.
//                    USDC/USDT are 6-decimal and need their ADAPTER address;
//                    passing the token address makes the tx fail.
//  - `yieldable`   → can be supplied to Aave V3 directly to earn yield.
//                    COPm is NOT on Aave → to earn yield we must swap COPm to a
//                    USD-stable first (Uniswap V3), then supply. See HACKATHON.md.

export type Stablecoin = {
  symbol: string;
  /** User-facing label (MiniPay copy rules: say "stablecoin"/"digital dollar", never "crypto"). */
  label: string;
  address: `0x${string}`;
  decimals: number;
  feeCurrency: `0x${string}`;
  yieldable: boolean;
};

const USDM = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const;

export const STABLECOINS: Stablecoin[] = [
  {
    symbol: "USDm",
    label: "Digital Dollar (USDm)",
    address: USDM,
    decimals: 18,
    feeCurrency: USDM, // 18-decimal: token == fee adapter
    yieldable: true,
  },
  {
    symbol: "USDC",
    label: "USDC",
    address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    decimals: 6,
    feeCurrency: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B", // adapter, not token
    yieldable: true,
  },
  {
    symbol: "USDT",
    label: "USDT",
    address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    decimals: 6,
    feeCurrency: "0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72", // adapter, not token
    yieldable: true,
  },
  {
    symbol: "COPm",
    label: "Peso Colombiano (COPm)",
    address: "0x8A567e2aE79CA692Bd748aB832081C45de4041eA",
    decimals: 18,
    feeCurrency: USDM, // COPm isn't a fee currency — pay the network fee in USDm
    yieldable: false, // not on Aave → swap to a USD-stable to earn yield
  },
];

// Celo Sepolia testnet COPm (NOT surfaced in MiniPay's testnet token list —
// confirm availability with mentors before a testnet demo). See HACKATHON.md.
export const COPM_TESTNET = "0x5F8d55c3627d2dc0a2B4afa798f877242F382F67" as const;

// Audited protocols the yield agent routes into (mainnet, from Celopedia).
export const PROTOCOLS = {
  aaveV3Pool: "0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402" as const,
  aaveUiPoolDataProvider: "0xe48424542b30b0b8D1Dc09099aceE407f40b4491" as const,
  aavePoolAddressesProvider: "0x9F7Cf9417D5251C59fE94fB9147feEe1aAd9Cea5" as const,
  uniswapV3SwapRouter02: "0x5615CDAb10dc425a742d643d949a7F474C01abc4" as const,
  uniswapV3QuoterV2: "0x82825d0554fA07f7FC52Ab63c961F330fdEFa8E8" as const,
};
