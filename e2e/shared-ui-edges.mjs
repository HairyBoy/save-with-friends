// Edge-case UI coverage for shared vaults: the draft invite button (copy-link
// fallback), the owner removing a member from the roster (✕), and a non-member
// (stranger) seeing the read-only view of /shared/[id].
//   node --env-file=../web/.env.local --env-file=../contracts/.env.deployer shared-ui-edges.mjs

import { chromium } from "playwright";
import { createWalletClient, createPublicClient, http } from "viem";
import { celoSepolia } from "viem/chains";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const BASE = process.env.BASE || "http://localhost:7951";
const RPC = "https://celo-sepolia.g.alchemy.com/v2/9oLIyDqxy32UaruybQQhA";
const ADAPTER = "0xbf1441Ea57f43f35f713431001f35742c88071c7";
const KEYS = { owner: process.env.OWNER_PK || process.env.TEST_USER_PK, ana: process.env.ANA_PK, luis: process.env.LUIS_PK };
const acc = Object.fromEntries(Object.entries(KEYS).map(([k, pk]) => [k, privateKeyToAccount(pk)]));
acc.stranger = privateKeyToAccount(generatePrivateKey()); // view-only, never signs/funds
const pub = createPublicClient({ chain: celoSepolia, transport: http(RPC) });
const wc = Object.fromEntries(Object.entries(acc).map(([k, account]) => [k, createWalletClient({ account, chain: celoSepolia, transport: http(RPC) })]));

const pass = [], fail = [];
const check = (c, m) => { (c ? pass : fail).push(m); console.log(`${c ? "✓" : "✗ FAIL"}  ${m}`); };
let rid = 1;
const rpc = async (m, p) => (await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: rid++, method: m, params: p ?? [] }) })).json()).result;

const browser = await chromium.launch();
async function mkPage(who) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["clipboard-read", "clipboard-write"] });
  const a = acc[who], wallet = wc[who];
  await ctx.exposeFunction("__walletRequest", async ({ method, params }) => {
    if (method === "eth_chainId") return "0xaa044c";
    if (method === "eth_accounts" || method === "eth_requestAccounts") return [a.address];
    if (method === "eth_sendTransaction") { const t = params[0]; return await wallet.sendTransaction({ to: t.to, data: t.data, value: t.value ? BigInt(t.value) : 0n, feeCurrency: t.feeCurrency ?? ADAPTER }); }
    return rpc(method, params);
  });
  await ctx.addInitScript(() => { window.ethereum = { isMiniPay: true, request: (x) => window.__walletRequest(x), on: () => {}, removeListener: () => {} }; });
  const page = await ctx.newPage();
  return { ctx, page };
}

const O = await mkPage("owner"), A = await mkPage("ana"), L = await mkPage("luis"), S = await mkPage("stranger");

// Owner makes a draft; Ana + Luis join.
await O.page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
await O.page.waitForTimeout(1500);
await O.page.fill("#ob-name", "Mateo");
await O.page.getByRole("button", { name: "Get started" }).click();
await O.page.waitForURL(`${BASE}/`, { timeout: 30000 });
await O.page.goto(`${BASE}/create`, { waitUntil: "networkidle" });
await O.page.getByRole("button", { name: "Shared" }).click();
await O.page.fill("#v-name", "Edge test");
await O.page.fill("#v-goal", "5");
await O.page.getByRole("button", { name: "1 week" }).click();
await O.page.getByRole("button", { name: "Everyone gets their own back" }).click();
await O.page.getByRole("button", { name: "Set up group vault" }).click();
await O.page.waitForURL(/\/draft\//, { timeout: 30000 });
const draftId = O.page.url().split("/draft/")[1];
for (const [ctx, name] of [[A, "Ana"], [L, "Luis"]]) {
  await ctx.page.goto(`${BASE}/draft/${draftId}`, { waitUntil: "networkidle" });
  await ctx.page.waitForSelector("text=Mateo", { timeout: 20000 });
  await ctx.page.waitForTimeout(2500);
  await ctx.page.fill('input[placeholder="Your name"]', name);
  await ctx.page.getByRole("button", { name: "Join", exact: true }).click();
  await ctx.page.waitForSelector("text=You're in", { timeout: 30000 });
}

// 1. Invite button → copy-link fallback (no navigator.share in headless)
await O.page.goto(`${BASE}/draft/${draftId}`, { waitUntil: "networkidle" });
await O.page.waitForSelector("text=Who's in (3)", { timeout: 20000 });
await O.page.getByRole("button", { name: /Invite friends/ }).click();
await O.page.waitForSelector("text=Invite link copied", { timeout: 10000 }).catch(() => {});
check((await O.page.locator("text=Invite link copied").count()) > 0, "1. Invite button copies the link (share-sheet fallback)");
const copied = await O.page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
check(copied.includes(`/draft/${draftId}`), "1. clipboard holds the draft invite URL");

// 2. Owner removes Luis from the roster (✕)
await O.page.locator("li", { hasText: "Luis" }).getByRole("button", { name: "Remove" }).click();
await O.page.waitForSelector("text=Who's in (2)", { timeout: 15000 });
check((await O.page.locator("text=Luis").count()) === 0, "2. owner removed Luis from the roster via ✕");

// Owner launches (members now: Mateo + Ana). $0 deposit, nothing contributed → no funds at risk.
await O.page.waitForTimeout(1500);
await O.page.getByRole("button", { name: "Create vault" }).click();
await O.page.waitForURL(/\/shared\//, { timeout: 120000 });
const id = O.page.url().split("/shared/")[1];

// 3. A non-member (stranger) sees the read-only view
await S.page.goto(`${BASE}/shared/${id}`, { waitUntil: "networkidle" });
await S.page.waitForSelector("text=Unlock conditions", { timeout: 20000 });
await S.page.waitForTimeout(2000);
check((await S.page.locator("text=viewing a group vault").count()) > 0, "3. non-member sees the read-only 'viewing a group vault' note");
check((await S.page.getByRole("button", { name: "Contribute" }).count()) === 0, "3. non-member has no Contribute button");
check((await S.page.getByRole("button", { name: "Approve early unlock" }).count()) === 0, "3. non-member has no Approve button");

await browser.close();
console.log(`\n===== ${pass.length} passed, ${fail.length} failed =====`);
if (fail.length) { console.log("FAILURES:\n" + fail.map((f) => " - " + f).join("\n")); process.exit(1); }
