// MiniPay deeplinks — the single source of truth for every "hand the user back
// to the MiniPay app" link. Add new MiniPay deeplinks here, never inline a
// `link.minipay.xyz` URL in a component.
//
// MiniPay listing requires that, when a user can't complete an action because
// their balance is too low, the app sends them to the Add Cash flow instead of
// dead-ending on an error. (Readiness checklist §6 — Low-Balance Handling.)
//
// Canonical deeplink list: https://docs.minipay.xyz/technical-references/deeplinks.html

// The stablecoins this app uses inside MiniPay (its first-class trio). Scoping
// the Add Cash deeplink to these pre-selects the right top-up options. CELO is
// intentionally never here — MiniPay hides it and pays network fees for the user.
const ADD_CASH_TOKENS = "USDm,USDC,USDT";

export const MINIPAY_DEEPLINKS = {
  /** Top-up screen. Use whenever a user's balance is too low to continue. */
  addCash: `https://link.minipay.xyz/add_cash?tokens=${ADD_CASH_TOKENS}`,
} as const;
