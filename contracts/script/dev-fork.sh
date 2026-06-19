#!/usr/bin/env bash
# Local end-to-end dev for the Aave-YIELD vaults.
#
# There is no Aave on Celo Sepolia, so the only way to click through the earning
# flow locally is against a fork of Celo MAINNET (real Aave + USDC) with fake gas.
# This script (with a fork node already running) deploys all four vault contracts
# bound to real USDC, funds the dev wallet (Anvil account #0) with USDC, and prints
# the env block the frontend's `celoFork` chain entry reads.
#
# 1) In one terminal, start the fork (chain id 31337 so the app treats it as the
#    local dev chain — dev wallet + time-travel work):
#
#      anvil --fork-url https://forno.celo.org --chain-id 31337
#
# 2) In another, from contracts/:  ./script/dev-fork.sh
#
set -euo pipefail

RPC="${RPC:-http://127.0.0.1:8545}"
# Anvil's well-known account #0 — public test key, local only, controls nothing real.
ACCOUNT0="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
KEY0="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
# Aave V3 Celo mainnet (bgd-labs/aave-address-book :: AaveV3Celo).
USDC="0xcebA9300f2b948710d2653dD7B07f33A8B32118C"   # 6 decimals
AUSDC="0xFF8309b9e99bfd2D4021bc71a362aBD93dBd4785"  # holds the pool's underlying USDC
FUND_USDC="${FUND_USDC:-10000000000}"               # 10,000 USDC (6 decimals)

echo "→ waiting for fork at $RPC ..."
for _ in $(seq 1 60); do
  if cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; then break; fi
done
cast chain-id --rpc-url "$RPC" >/dev/null 2>&1 || { echo "✗ no node at $RPC — start anvil --fork-url first"; exit 1; }

echo "→ deploying plain vaults (bound to real USDC) ..."
PLAIN=$(VAULT_TOKEN="$USDC" forge script script/Deploy.s.sol \
  --rpc-url "$RPC" --private-key "$KEY0" --broadcast 2>&1)
SAVINGS=$(printf '%s\n' "$PLAIN" | sed -n 's/.*SavingsVaults: *//p' | tr -d ' ')
SHARED=$(printf '%s\n' "$PLAIN"  | sed -n 's/.*SharedVaults: *//p'  | tr -d ' ')

echo "→ deploying yield vaults ..."
YIELD=$(forge script script/DeployYield.s.sol \
  --rpc-url "$RPC" --private-key "$KEY0" --broadcast 2>&1)
YSAVINGS=$(printf '%s\n' "$YIELD" | sed -n 's/.*YieldSavingsVaults: *//p' | tr -d ' ')
YSHARED=$(printf '%s\n' "$YIELD"  | sed -n 's/.*YieldSharedVaults: *//p'  | tr -d ' ')

echo "→ funding dev wallet ($ACCOUNT0) with USDC (impersonating the aToken) ..."
cast rpc anvil_impersonateAccount "$AUSDC" --rpc-url "$RPC" >/dev/null
cast rpc anvil_setBalance "$AUSDC" 0xDE0B6B3A7640000 --rpc-url "$RPC" >/dev/null  # 1 ETH gas
cast send "$USDC" "transfer(address,uint256)" "$ACCOUNT0" "$FUND_USDC" \
  --from "$AUSDC" --unlocked --rpc-url "$RPC" >/dev/null
cast rpc anvil_stopImpersonatingAccount "$AUSDC" --rpc-url "$RPC" >/dev/null
BAL=$(cast call "$USDC" "balanceOf(address)(uint256)" "$ACCOUNT0" --rpc-url "$RPC")

cat <<EOF

✓ Fork ready. Dev wallet USDC balance: $BAL (base units, 6 dp)

Run the app against the fork with:

  NEXT_PUBLIC_CHAIN=celoFork \\
  NEXT_PUBLIC_FORK_SAVINGS=$SAVINGS \\
  NEXT_PUBLIC_FORK_SHARED=$SHARED \\
  NEXT_PUBLIC_FORK_YIELD_SAVINGS=$YSAVINGS \\
  NEXT_PUBLIC_FORK_YIELD_SHARED=$YSHARED \\
  npm run dev

(From a FRESH fork these addresses are deterministic, matching the celoFork
defaults baked into lib/chains.ts — so the env overrides are usually optional.)
EOF
