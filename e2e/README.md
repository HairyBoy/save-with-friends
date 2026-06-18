# e2e — manual testnet end-to-end tests

Browser-driven tests that exercise the **real UI** against the **real Celo Sepolia
contract** with **real wallet signing** (a mock EIP-1193 provider per browser context,
backed by a Node viem signer — the same shape as MiniPay's injected wallet). Kept as a
separate package so Playwright stays out of the app's dependencies.

These are **manual** (not CI): they need testnet secrets and spend a little test USDC
(fully recovered — each test withdraws what it deposits, so net cost is ~cents of gas).

## `friend-invite-unlock.mjs` — Phase 1 friend-keys

Proves the keyholder-approves-from-their-own-wallet flow and its access control:

1. Owner adds a friend by address → picks them as a keyholder → creates a below-goal,
   before-deadline vault (so only a friend approval can unlock it).
2. Owner on their own vault sees Deposit, **not** "Approve unlock" (can't self-approve).
3. A non-keyholder sees a read-only note, no actions — and a direct `approveEarlyExit`
   reverts on-chain.
4. The keyholder opens the vault and **approves from their own wallet** → it unlocks.
5. Once unlocked the button is gone, and a redundant approve is an idempotent no-op
   (can't inflate the threshold).
6. Owner withdraws → vault closed, deposit recovered.

## Running it

```bash
cd e2e
npm install
npx playwright install chromium      # one-time browser download

# Build + serve the app on the port the test expects (default :7951):
( cd ../web && npm run build && npx next start -p 7951 )   # in another shell

# Run, loading secrets from the gitignored env files (Node 22+ multi --env-file):
node --env-file=../web/.env.local --env-file=../contracts/.env.deployer friend-invite-unlock.mjs
```

### Env vars

Required (read from the env files above, or export them yourself):

- `OWNER_PK` (falls back to `TEST_USER_PK`) — the vault owner's key
- `ANA_PK`, `ANA_ADDRESS` — the keyholder's key + address
- `LUIS_PK` — a third wallet used as the "stranger" (needs no funds; it only reads)

Optional (sensible testnet defaults):

- `BASE` (default `http://localhost:7951`)
- `E2E_RPC` / `CELO_SEPOLIA_RPC` (default public forno)
- `E2E_VAULT` / `NEXT_PUBLIC_SAVINGS_VAULTS_ADDRESS`, `E2E_FEE_ADAPTER`

Exit code is non-zero if any assertion fails.
