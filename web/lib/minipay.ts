// MiniPay deeplinks — the single source of truth for every "hand the user back
// to the MiniPay app" link. Add new MiniPay deeplinks here, never inline a
// `link.minipay.xyz` URL in a component.
//
// MiniPay listing requires that, when a user can't complete an action because
// their balance is too low, the app sends them to the Add Cash flow instead of
// dead-ending on an error. (Readiness checklist §6 — Low-Balance Handling.)
//
// Canonical deeplink list: https://docs.minipay.xyz/technical-references/deeplinks.html

// The stablecoin this app uses inside MiniPay. Vaults are held in USDC only for
// now (the Mento auto-swap is deferred), so the Add Cash deeplink is scoped to
// USDC — a low-balance user tops up the exact token they need, not a mix they'd
// then have to swap. CELO is intentionally never here — MiniPay hides it and pays
// network fees for the user. Widen this when multi-stablecoin support lands.
const ADD_CASH_TOKENS = "USDC";

export const MINIPAY_DEEPLINKS = {
  /** Top-up screen. Use whenever a user's balance is too low to continue. */
  addCash: `https://link.minipay.xyz/add_cash?tokens=${ADD_CASH_TOKENS}`,
} as const;
