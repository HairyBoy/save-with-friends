<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project conventions

## Insufficient-balance UX → always use `BalanceNotice`

Any amount input that can exceed the user's wallet balance MUST render
`components/BalanceNotice.tsx` for its under-the-input message — do **not** hand-roll
an "insufficient funds" / available-balance line.

Why: MiniPay listing requires that a too-low balance redirects the user to the Add
Cash top-up flow instead of dead-ending on an error (readiness checklist §6).
`BalanceNotice` owns that "Add money" deeplink, so reusing it everywhere keeps the
requirement satisfied as new deposit/contribute flows are added. The deeplink itself
lives in `lib/minipay.ts` (`MINIPAY_DEEPLINKS`) — never inline a `link.minipay.xyz` URL.

Current call sites: `app/(tabs)/create/page.tsx`, `app/vault/[id]/page.tsx`.
