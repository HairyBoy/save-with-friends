// Second shared-vault UI e2e: the OWNER-TAKES-ALL (group gift) payout + the home
// screen + role views — the paths the by-contribution e2e didn't cover.
//   • Create→Shared with "Group gift" payout → launch (owner gifts $0; members fund).
//   • Home lists the shared vault and taps through to it.
//   • Members contribute → majority-approve → a non-owner sees the gift note → the
//     owner claims the whole pot.
//   node --env-file=../web/.env.local --env-file=../contracts/.env.deployer shared-ui-gift.mjs

import { chromium } from "playwright";
import { createWalletClient, createPublicClient, http } from "viem";
import { celoSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const BASE = process.env.BASE || "http://localhost:7951";
const RPC = "https://celo-sepolia.g.alchemy.com/v2/9oLIyDqxy32UaruybQQhA";
const ADAPTER = "0xbf1441Ea57f43f35f713431001f35742c88071c7";
const SHARED = "0xFA72C790C970F2bB76994E6a88219B4F420433e9";
const USDC = "0x01C5C0122039549AD1493B8220cABEdD739BC44E";
const KEYS = { owner: process.env.OWNER_PK || process.env.TEST_USER_PK, ana: process.env.ANA_PK, luis: process.env.LUIS_PK };
const abi = [
  { type: "function", name: "unlocked", inputs: [{ type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "function", name: "getVault", inputs: [{ type: "uint256" }], outputs: [{ type: "tuple", components: [
    { name: "owner", type: "address" }, { name: "deadline", type: "uint64" }, { name: "closed", type: "bool" },
    { name: "payout", type: "uint8" }, { name: "goalReached", type: "bool" }, { name: "goal", type: "uint256" },
    { name: "saved", type: "uint256" }, { name: "approvals", type: "uint32" }, { name: "memberCount", type: "uint32" }] }], stateMutability: "view" },
];
const erc20 = [{ type: "function", name: "balanceOf", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" }];
const acc = Object.fromEntries(Object.entries(KEYS).map(([k, pk]) => [k, privateKeyToAccount(pk)]));
const pub = createPublicClient({ chain: celoSepolia, transport: http(RPC) });
const wc = Object.fromEntries(Object.entries(acc).map(([k, account]) => [k, createWalletClient({ account, chain: celoSepolia, transport: http(RPC) })]));
const getVault = (id) => pub.readContract({ address: SHARED, abi, functionName: "getVault", args: [id] });
const usdc = (a) => pub.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [a] });

const pass = [], fail = [];
const check = (c, m) => { (c ? pass : fail).push(m); console.log(`${c ? "✓" : "✗ FAIL"}  ${m}`); };
async function waitFor(cond, ms = 90000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 2500)); }
  return false;
}
let rid = 1;
const rpc = async (m, p) => (await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: rid++, method: m, params: p ?? [] }) })).json()).result;

const browser = await chromium.launch();
async function mkPage(who) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const a = acc[who], wallet = wc[who];
  await ctx.exposeFunction("__walletRequest", async ({ method, params }) => {
    if (method === "eth_chainId") return "0xaa044c";
    if (method === "eth_accounts" || method === "eth_requestAccounts") return [a.address];
    if (method === "eth_sendTransaction") { const t = params[0]; return await wallet.sendTransaction({ to: t.to, data: t.data, value: t.value ? BigInt(t.value) : 0n, feeCurrency: t.feeCurrency ?? ADAPTER }); }
    return rpc(method, params);
  });
  await ctx.addInitScript(() => { window.ethereum = { isMiniPay: true, request: (x) => window.__walletRequest(x), on: () => {}, removeListener: () => {} }; });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

const O = await mkPage("owner"), A = await mkPage("ana"), L = await mkPage("luis");

// 1. Owner creates a GROUP GIFT (owner-takes-all) shared vault → draft
await O.page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
await O.page.waitForTimeout(1500);
await O.page.fill("#ob-name", "Mateo");
await O.page.getByRole("button", { name: "Get started" }).click();
await O.page.waitForURL(`${BASE}/`, { timeout: 30000 });
await O.page.goto(`${BASE}/create`, { waitUntil: "networkidle" });
await O.page.getByRole("button", { name: "Shared" }).click();
await O.page.fill("#v-name", "Sofia's gift");
await O.page.fill("#v-goal", "5");
await O.page.getByRole("button", { name: "1 week" }).click();
await O.page.getByRole("button", { name: "Group gift — goes to me" }).click();
await O.page.getByRole("button", { name: "Set up group vault" }).click();
await O.page.waitForURL(/\/draft\//, { timeout: 30000 });
const draftId = O.page.url().split("/draft/")[1];
check(Boolean(draftId), `1. Create→Shared (group gift) assembled a draft (${draftId})`);

// 2. Friends join
for (const [ctx, name] of [[A, "Ana"], [L, "Luis"]]) {
  await ctx.page.goto(`${BASE}/draft/${draftId}`, { waitUntil: "networkidle" });
  await ctx.page.waitForSelector("text=Mateo", { timeout: 20000 });
  await ctx.page.waitForTimeout(2500);
  await ctx.page.fill('input[placeholder="Your name"]', name);
  await ctx.page.getByRole("button", { name: "Join", exact: true }).click();
  await ctx.page.waitForSelector("text=You're in", { timeout: 30000 });
}

// 3. Owner launches with NO deposit (a pure gift — members fund it)
await O.page.goto(`${BASE}/draft/${draftId}`, { waitUntil: "networkidle" });
await O.page.waitForSelector("text=Who's in (3)", { timeout: 20000 });
await O.page.waitForTimeout(2500);
await O.page.getByRole("button", { name: "Create vault" }).click();
await O.page.waitForURL(/\/shared\//, { timeout: 120000 });
const id = BigInt(O.page.url().split("/shared/")[1]);
const v0 = await getVault(id);
check(v0.memberCount === 3 && v0.payout === 1, `3. launched owner-takes-all vault #${id} (payout=${v0.payout})`);

// 4. HOME lists the shared vault + taps through to it
await O.page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await O.page.waitForSelector("text=Sofia's gift", { timeout: 20000 });
check((await O.page.locator("text=Sofia's gift").count()) > 0, "4. home lists the shared vault by name");
await O.page.getByText("Sofia's gift").click();
await O.page.waitForURL(`${BASE}/shared/${id}`, { timeout: 20000 });
check(true, "4. tapping the home card opens /shared/[id]");

// 5. Members contribute, then majority-approve
for (const ctx of [A, L]) {
  await ctx.page.goto(`${BASE}/shared/${id}`, { waitUntil: "networkidle" });
  await ctx.page.waitForSelector("text=Unlock conditions");
  await ctx.page.waitForTimeout(2500);
  const before = (await getVault(id)).saved;
  await ctx.page.fill('input[inputmode="decimal"]', "0.10");
  await ctx.page.getByRole("button", { name: "Contribute" }).click();
  await waitFor(async () => (await getVault(id)).saved > before);
}
for (const ctx of [O, A]) {
  await ctx.page.goto(`${BASE}/shared/${id}`, { waitUntil: "networkidle" });
  await ctx.page.waitForSelector("text=Unlock conditions");
  await ctx.page.waitForTimeout(2500);
  const before = (await getVault(id)).approvals;
  await ctx.page.getByRole("button", { name: "Approve early unlock" }).click();
  await waitFor(async () => (await getVault(id)).approvals > before);
}
check(await pub.readContract({ address: SHARED, abi, functionName: "unlocked", args: [id] }), "5. majority approval via UI → unlocked");

// 6. A non-owner sees the GIFT NOTE (no claim/withdraw button for them)
await A.page.goto(`${BASE}/shared/${id}`, { waitUntil: "networkidle" });
await A.page.waitForSelector("text=Unlock conditions");
check((await A.page.locator("text=pays out to the owner").count()) > 0, "6. non-owner sees the 'pays out to the owner' gift note");
check((await A.page.getByRole("button", { name: "Claim the pot" }).count()) === 0, "6. non-owner has no claim button");

// 7. Owner claims the whole pot
const ownerBefore = await usdc(acc.owner.address);
const potBefore = (await getVault(id)).saved;
await O.page.goto(`${BASE}/shared/${id}`, { waitUntil: "networkidle" });
await O.page.waitForSelector("text=Unlock conditions");
await O.page.waitForTimeout(2500);
await O.page.getByRole("button", { name: "Claim the pot" }).click();
await waitFor(async () => (await getVault(id)).closed);
const vF = await getVault(id);
check(vF.closed && vF.saved === 0n, "7. owner claimed the pot via UI → vault closed");
check((await usdc(acc.owner.address)) - ownerBefore > 0n && potBefore === 200000n, `7. owner received the $0.20 pot (net of gas; pot was ${potBefore})`);

const errs = [...O.errors, ...A.errors, ...L.errors];
check(errs.length === 0, `console/page errors: ${errs.length ? errs.join(" | ") : "none"}`);

await browser.close();
console.log(`\n===== ${pass.length} passed, ${fail.length} failed =====`);
if (fail.length) { console.log("FAILURES:\n" + fail.map((f) => " - " + f).join("\n")); process.exit(1); }
