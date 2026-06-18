// Validation for the ODIS phone→address resolution (lib/odis.ts), to run at the
// MAINNET cutover — there's no ODIS on Celo Sepolia and Alfajores is deprecated
// (no faucet), so mainnet is the only place this can actually run.
//
// It resolves a real phone number to the address MiniPay attested for it: tops up
// ODIS quota if needed, runs the PnP obfuscation, and looks up the trusted issuer's
// attestation — the same flow the /api/resolve-phone route uses.
//
// Prereq: ODIS_QUERY_PK funded on the target chain with CELO (gas) + cUSD (quota).
//
// Run from web/:
//   ODIS_CHAIN=mainnet ODIS_TEST_PHONE=+57XXXXXXXXXX \
//     node --env-file=.env.local scripts/odis-resolve-check.mjs

import { newKit } from "@celo/contractkit";
import { OdisUtils } from "@celo/identity";

const MINIPAY_ISSUER = "0x7888612486844Bb9BE598668081c59A9f7367FBc";
const CHAIN = process.env.ODIS_CHAIN === "mainnet" ? "mainnet" : "alfajores";
const RPC = CHAIN === "mainnet" ? "https://forno.celo.org" : "https://alfajores-forno.celo-testnet.org";
const CONTEXT = CHAIN === "mainnet" ? OdisUtils.Query.OdisContextName.MAINNET : OdisUtils.Query.OdisContextName.ALFAJORES;
const TOPUP_WEI = 10000000000000000n; // 0.01 cUSD (18 dp)

const phone = process.env.ODIS_TEST_PHONE;
const raw = process.env.ODIS_QUERY_PK;
if (!raw) { console.error("ODIS_QUERY_PK not set"); process.exit(2); }
if (!phone) { console.error("ODIS_TEST_PHONE not set (e.g. +57XXXXXXXXXX)"); process.exit(2); }
const pk = raw.startsWith("0x") ? raw : `0x${raw}`;

const kit = newKit(RPC);
kit.addAccount(pk);
const [account] = kit.connection.getLocalAccounts();
kit.defaultAccount = account;
const issuers = process.env.ODIS_TRUSTED_ISSUERS
  ? process.env.ODIS_TRUSTED_ISSUERS.split(",").map((s) => s.trim()).filter(Boolean)
  : CHAIN === "mainnet" ? [MINIPAY_ISSUER] : [account];
console.log(`chain=${CHAIN} querying=${account} issuers=${issuers.join(",")}\n`);

const serviceContext = OdisUtils.Query.getServiceContext(CONTEXT, OdisUtils.Query.OdisAPI.PNP);
const authSigner = { authenticationMethod: OdisUtils.Query.AuthenticationMethod.WALLET_KEY, contractKit: kit };

const stable = await kit.contracts.getStableToken();
console.log("CELO:", (await kit.connection.getBalance(account)).toString(), "| cUSD:", (await stable.balanceOf(account)).toString());

let quota = await OdisUtils.Quota.getPnpQuotaStatus(account, authSigner, serviceContext);
console.log("PnP quota:", JSON.stringify(quota));
if (Number(quota.remainingQuota) <= 0) {
  console.log("topping up quota via OdisPayments.payInCUSD…");
  const odisPayments = await kit.contracts.getOdisPayments();
  await stable.increaseAllowance(odisPayments.address, TOPUP_WEI.toString()).sendAndWaitForReceipt();
  await odisPayments.payInCUSD(account, TOPUP_WEI.toString()).sendAndWaitForReceipt();
  quota = await OdisUtils.Quota.getPnpQuotaStatus(account, authSigner, serviceContext);
  console.log("PnP quota after top-up:", JSON.stringify(quota));
}

const { obfuscatedIdentifier } = await OdisUtils.Identifier.getObfuscatedIdentifier(
  phone, OdisUtils.Identifier.IdentifierPrefix.PHONE_NUMBER, account, authSigner, serviceContext,
);
const fa = await kit.contracts.getFederatedAttestations();
const { accounts } = await fa.lookupAttestations(obfuscatedIdentifier, issuers);
console.log("\nresolved accounts:", accounts);
console.log(accounts[0] ? `\n✓ ${phone} → ${accounts[0]}` : `\n✗ no attestation for ${phone} under the trusted issuer(s)`);
process.exit(accounts[0] ? 0 : 1);
