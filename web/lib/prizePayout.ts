// Raffle prize payout (P3) — send the COPm prize from the hot prize wallet to a
// winner. Server-only: it uses the prize wallet's private key (see getPrizeWalletClient).
// On Celo, gas is paid in the stablecoin via FEE_OPTS so the prize wallet needs no
// CELO (it does need a small fee-currency balance). On Anvil, native gas.

import { erc20Abi, parseUnits, type Address, type Hash } from "viem";
import {
  FEE_OPTS,
  getPrizeWalletAddress,
  getPrizeWalletClient,
  getPublicClient,
  PRIZE_TOKEN,
  PRIZE_TOKEN_DECIMALS,
  toCop,
} from "@/lib/chains";
import { readPrizeTokenBalance } from "@/lib/onchainVaults";

/**
 * An address's balance of the prize token (COPm on mainnet; the stand-in token on
 * test chains), as a human COP number. Best-effort: 0 on any read failure. Used to
 * show a saver their COP winnings in-app (MiniPay also shows it natively).
 */
export async function prizeTokenBalanceOf(address: Address): Promise<number> {
  try {
    return toCop(await readPrizeTokenBalance(address));
  } catch {
    return 0;
  }
}

/**
 * Whether the prize wallet currently holds at least `amountCopm` of the prize
 * token — i.e. the raffle can actually pay out. The draw gates on this, and the
 * public read route shows it. Uses only the wallet ADDRESS (no signer is built on
 * the read path). Returns false (rather than throwing) if the wallet isn't
 * configured or the chain read fails, so a bad/unreachable setup safely means "no
 * draw" instead of an error.
 */
export async function isPrizeFunded(amountCopm: number): Promise<boolean> {
  let addr: Address;
  try {
    addr = getPrizeWalletAddress();
  } catch {
    return false; // no prize wallet configured → treat as unfunded
  }
  try {
    const balance = await getPublicClient().readContract({
      address: PRIZE_TOKEN,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [addr],
    });
    return balance >= parseUnits(String(amountCopm), PRIZE_TOKEN_DECIMALS);
  } catch {
    return false;
  }
}

/**
 * Transfer `amountCopm` of the prize token to `to`. Blocks until mined and throws
 * on revert (so the caller never marks a draw `paid` for a failed transfer).
 * Returns the transaction hash to record.
 */
export async function sendPrize(to: Address, amountCopm: number): Promise<Hash> {
  const wallet = getPrizeWalletClient();
  const amount = parseUnits(String(amountCopm), PRIZE_TOKEN_DECIMALS);
  const hash = await wallet.writeContract({
    address: PRIZE_TOKEN,
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amount],
    ...FEE_OPTS,
  });
  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") throw new Error("prize transfer reverted on-chain");
  return hash;
}
