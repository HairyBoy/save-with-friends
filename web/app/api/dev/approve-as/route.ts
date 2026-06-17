// DEV/TEST-ONLY: signs SavingsVaults.approveEarlyExit as a stub keyholder, using
// that keyholder's SERVER-ONLY private key (ANA_PK / LUIS_PK). This lets the
// in-app "approve as keyholder" panel work on the testnet WITHOUT shipping the
// friend keys to the client. Gated to Celo Sepolia — it must never run against
// mainnet, since it signs with embedded keys. In production a friend approves
// from their own wallet and this route doesn't exist.
import { createPublicClient, createWalletClient, http } from "viem";
import { celoSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { CONTRACTS } from "@/lib/chains";
import { savingsVaultsAbi } from "@/lib/savingsVaultsAbi";

const RPC = process.env.CELO_SEPOLIA_RPC || "https://forno.celo-sepolia.celo-testnet.org";
const USDC_FEE_ADAPTER = "0xbf1441Ea57f43f35f713431001f35742c88071c7"; // gas paid in USDC

// keyholder address (lowercased) -> its server-only private key
function keyFor(addr: string): `0x${string}` | undefined {
  const map: Record<string, string | undefined> = {
    "0xf84658ee8704269e863e9cf28dd38d4007dd2080": process.env.ANA_PK,
    "0xe092ef39dcd29016f07f5d3fa283f9456ba9a7c2": process.env.LUIS_PK,
  };
  return map[addr.toLowerCase()] as `0x${string}` | undefined;
}

export async function POST(request: Request) {
  // OFF unless explicitly enabled AND on testnet. Safe to deploy on a public URL
  // (it does nothing) until ENABLE_DEV_APPROVE=true is set — and it must never be
  // enabled on a mainnet/production deploy (it signs with embedded keys).
  if (process.env.ENABLE_DEV_APPROVE !== "true" || process.env.NEXT_PUBLIC_CHAIN !== "celoSepolia") {
    return Response.json({ error: "dev approve-as is disabled" }, { status: 403 });
  }
  const { id, keyholder } = (await request.json()) as { id?: string; keyholder?: string };
  if (id == null || !keyholder) {
    return Response.json({ error: "id and keyholder required" }, { status: 400 });
  }
  const pk = keyFor(keyholder);
  if (!pk) {
    return Response.json({ error: `no server key for keyholder ${keyholder}` }, { status: 400 });
  }

  const account = privateKeyToAccount(pk);
  const pub = createPublicClient({ chain: celoSepolia, transport: http(RPC) });
  const wallet = createWalletClient({ account, chain: celoSepolia, transport: http(RPC) });
  try {
    const hash = await wallet.writeContract({
      address: CONTRACTS.savingsVaults,
      abi: savingsVaultsAbi,
      functionName: "approveEarlyExit",
      args: [BigInt(id)],
      feeCurrency: USDC_FEE_ADAPTER,
    });
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") {
      return Response.json({ error: "approveEarlyExit reverted on-chain" }, { status: 400 });
    }
    return Response.json({ ok: true, hash });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "approve failed" },
      { status: 400 },
    );
  }
}
