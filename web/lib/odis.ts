// SERVER-ONLY: phone number → wallet address resolution via Celo's ODIS (PnP) +
// FederatedAttestations (the "SocialConnect" pattern). This is how a MiniPay-proper
// app lets you add a friend by phone instead of pasting a 0x address.
//
// IMPORTANT — chain reality (verified against the celopedia skill):
//   • There is NO ODIS on Celo Sepolia (our app's chain). ODIS contexts are MAINNET
//     and ALFAJORES only, and the real MiniPay phone→address attestations live on
//     MAINNET (issuer 0x7888…). So resolution runs on its OWN chain, independent of
//     where the vaults live — the resolved address is just an EVM address we then use
//     as a keyholder on the (testnet) vault.
//   • Resolution must run server-side with a funded querying wallet that holds ODIS
//     quota (cUSD via OdisPayments). Keys never touch the client.
//
// Config (env): ODIS_QUERY_PK (querying wallet), ODIS_CHAIN ("alfajores" | "mainnet"),
// ODIS_TRUSTED_ISSUERS (defaults: MiniPay issuer on mainnet; our own querying wallet
// on Alfajores, where we self-attest test mappings to validate the mechanics).

import { newKit } from "@celo/contractkit";
import { OdisUtils } from "@celo/identity";
import type { AuthSigner } from "@celo/identity/lib/odis/query";

const MINIPAY_ISSUER = "0x7888612486844Bb9BE598668081c59A9f7367FBc";

const CHAIN = process.env.ODIS_CHAIN === "mainnet" ? "mainnet" : "alfajores";
const RPC =
  CHAIN === "mainnet"
    ? "https://forno.celo.org"
    : "https://alfajores-forno.celo-testnet.org";
const CONTEXT =
  CHAIN === "mainnet"
    ? OdisUtils.Query.OdisContextName.MAINNET
    : OdisUtils.Query.OdisContextName.ALFAJORES;

export function isOdisConfigured(): boolean {
  return Boolean(process.env.ODIS_QUERY_PK);
}

// Whose attestations we trust. Mainnet → MiniPay's issuer. Alfajores → our own
// querying wallet (it self-attests test mappings). Override with ODIS_TRUSTED_ISSUERS.
function trustedIssuers(queryAccount: string): string[] {
  const fromEnv = process.env.ODIS_TRUSTED_ISSUERS;
  if (fromEnv) return fromEnv.split(",").map((s) => s.trim()).filter(Boolean);
  return CHAIN === "mainnet" ? [MINIPAY_ISSUER] : [queryAccount];
}

/**
 * Resolve an E.164 phone number to the wallet address attested for it by a trusted
 * issuer. Returns null if no attestation is found. Throws on a malformed number or
 * an ODIS/quota failure (the caller surfaces a friendly message).
 */
export async function resolvePhone(phoneE164: string): Promise<string | null> {
  const raw = process.env.ODIS_QUERY_PK;
  if (!raw) throw new Error("ODIS_QUERY_PK not set");
  const pk = raw.startsWith("0x") ? raw : `0x${raw}`;

  const kit = newKit(RPC);
  kit.addAccount(pk);
  const [account] = kit.connection.getLocalAccounts();
  if (!account) throw new Error("no local querying account");
  kit.defaultAccount = account;

  const serviceContext = OdisUtils.Query.getServiceContext(CONTEXT, OdisUtils.Query.OdisAPI.PNP);
  // @celo/identity bundles its own copy of @celo/contractkit, so the ContractKit from
  // our newKit() is structurally identical but a nominally different type — cast across
  // the package boundary (the runtime object is exactly what the SDK expects).
  const authSigner = {
    authenticationMethod: OdisUtils.Query.AuthenticationMethod.WALLET_KEY,
    contractKit: kit,
  } as unknown as AuthSigner;

  // ODIS PnP: phone → obfuscated identifier (this consumes the querying wallet's quota).
  const { obfuscatedIdentifier } = await OdisUtils.Identifier.getObfuscatedIdentifier(
    phoneE164,
    OdisUtils.Identifier.IdentifierPrefix.PHONE_NUMBER,
    account,
    authSigner,
    serviceContext,
  );

  // On-chain lookup of the address attested for that identifier by a trusted issuer.
  const federated = await kit.contracts.getFederatedAttestations();
  const { accounts } = await federated.lookupAttestations(obfuscatedIdentifier, trustedIssuers(account));
  return accounts[0] ?? null;
}
