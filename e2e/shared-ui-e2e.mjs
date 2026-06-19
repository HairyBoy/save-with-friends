// Full multi-wallet UI e2e for SHARED vaults — drives every new screen against the
// real testnet + Neon: onboard → Create(Shared)→draft → friends join via the draft
// link → owner launches on-chain → members contribute → majority-approve → withdraw.
// Three wallets, each its own browser context with a mock MiniPay provider.
//   node --env-file=../web/.env.local --env-file=../contracts/.env.deployer shared-ui-e2e.mjs

import { chromium } from "playwright";
import { createWalletClient, createPublicClient, http } from "viem";
import { celoSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const BASE = process.env.BASE || "http://localhost:7951";
const RPC = "https://celo-sepolia.g.alchemy.com/v2/9oLIyDqxy32UaruybQQhA";
const ADAPTER = "0xbf1441Ea57f43f35f713431001f35742c88071c7";
const SHARED = "0xFA72C790C970F2bB76994E6a88219B4F420433e9";
const KEYS = {
  owner: process.env.OWNER_PK || process.env.TEST_USER_PK,
  ana: process.env.ANA_PK,
  luis: process.env.LUIS_PK,
};
const abi = [
  { type: "function", name: "unlocked", inputs: [{ type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "function", name: "getVault", inputs: [{ type: "uint256" }], outputs: [{ type: "tuple", components: [
    { name: "owner", type: "address" }, { name: "deadline", type: "uint64" }, { name: "closed", type: "bool" },
    { name: "payout", type: "uint8" }, { name: "goalReached", type: "bool" }, { name: "goal", type: "uint256" },
    { name: "saved", type: "uint256" }, { name: "approvals", type: "uint32" }, { name: "memberCount", type: "uint32" }] }], stateMutability: "view" },
  { type: "function", name: "getMembers", inputs: [{ type: "uint256" }], outputs: [{ type: "address[]" }], stateMutability: "view" },
];
const acc = Object.fromEntries(Object.entries(KEYS).map(([k, pk]) => [k, privateKeyToAccount(pk)]));
const pub = createPublicClient({ chain: celoSepolia, transport: http(RPC) });
const wc = Object.fromEntries(Object.entries(acc).map(([k, account]) => [k, createWalletClient({ account, chain: celoSepolia, transport: http(RPC) })]));
const getVault = (id) => pub.readContract({ address: SHARED, abi, functionName: "getVault", args: [id] });

const pass = [], fail = [];
const check = (c, m) => { (c ? pass : fail).push(m); console.log(`${c ? "✓" : "✗ FAIL"}  ${m}`); };
async function waitFor(cond, ms = 90000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await cond()) return true;
    await new Promise((r) => setTimeout(r, 2500));
  }
  return false;
}

let rid = 1;
async function rpc(m, p) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: rid++, method: m, params: p ?? [] }) });
  return (await r.json()).result;
}
const browser = await chromium.launch();
async function mkPage(who) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const a = acc[who], wallet = wc[who];
  await ctx.exposeFunction("__walletRequest", async ({ method, params }) => {
    if (method === "eth_chainId") return "0xaa044c";
    if (method === "eth_accounts" || method === "eth_requestAccounts") return [a.address];
    if (method === "eth_sendTransaction") {
      const t = params[0];
      return await wallet.sendTransaction({ to: t.to, data: t.data, value: t.value ? BigInt(t.value) : 0n, feeCurrency: t.feeCurrency ?? ADAPTER });
    }
    return rpc(method, params);
  });
  await ctx.addInitScript(() => { window.ethereum = { isMiniPay: true, request: (x) => window.__walletRequest(x), on: () => {}, removeListener: () => {} }; });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

const O = await mkPage("owner"), A = await mkPage("ana"), L = await mkPage("luis");

// 1. Owner onboards + creates a SHARED vault → draft
await O.page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
await O.page.waitForTimeout(1500);
await O.page.fill("#ob-name", "Mateo");
await O.page.getByRole("button", { name: "Get started" }).click();
await O.page.waitForURL(`${BASE}/`, { timeout: 30000 });
await O.page.goto(`${BASE}/create`, { waitUntil: "networkidle" });
await O.page.getByRole("button", { name: "Shared" }).click();
await O.page.fill("#v-name", "Group trip");
await O.page.fill("#v-goal", "5");
await O.page.getByRole("button", { name: "1 week" }).click();
await O.page.getByRole("button", { name: "Everyone gets their own back" }).click();
await O.page.getByRole("button", { name: "Set up group vault" }).click();
await O.page.waitForURL(/\/draft\//, { timeout: 30000 });
const draftId = O.page.url().split("/draft/")[1];
check(Boolean(draftId), `1. Create→Shared assembled a draft (${draftId})`);

// 2. Friends open the draft link and join (wait for the mock wallet to connect first)
for (const [ctx, name] of [[A, "Ana"], [L, "Luis"]]) {
  await ctx.page.goto(`${BASE}/draft/${draftId}`, { waitUntil: "networkidle" });
  await ctx.page.waitForSelector("text=Mateo", { timeout: 20000 });
  await ctx.page.waitForTimeout(2500);
  await ctx.page.fill('input[placeholder="Your name"]', name);
  await ctx.page.getByRole("button", { name: "Join", exact: true }).click();
  await ctx.page.waitForSelector("text=You're in", { timeout: 30000 });
}
check(true, "2. Ana + Luis joined the roster via the draft link");

// 3. Owner reviews the roster + launches on-chain
await O.page.goto(`${BASE}/draft/${draftId}`, { waitUntil: "networkidle" });
await O.page.waitForSelector("text=Who's in (3)", { timeout: 20000 });
check((await O.page.locator("text=Ana").count()) > 0 && (await O.page.locator("text=Luis").count()) > 0, "3. owner sees the full roster (Mateo + Ana + Luis)");
await O.page.waitForTimeout(2500);
await O.page.fill("#d-deposit", "0.10");
await O.page.getByRole("button", { name: "Create vault" }).click();
await O.page.waitForURL(/\/shared\//, { timeout: 120000 });
const id = BigInt(O.page.url().split("/shared/")[1]);
const v0 = await getVault(id);
check(v0.memberCount === 3 && v0.owner.toLowerCase() === acc.owner.address.toLowerCase(), `3. launched shared vault #${id} on-chain (3 members, owner=Mateo)`);
check(v0.saved === 100000n, "3. owner's $0.10 starting deposit is in the pot");

// 4. Members contribute via the detail screen (poll the chain for the 2-tx deposit)
for (const ctx of [A, L]) {
  await ctx.page.goto(`${BASE}/shared/${id}`, { waitUntil: "networkidle" });
  await ctx.page.waitForSelector("text=Unlock conditions");
  await ctx.page.waitForTimeout(2500);
  const before = (await getVault(id)).saved;
  await ctx.page.fill('input[inputmode="decimal"]', "0.10");
  await ctx.page.getByRole("button", { name: "Contribute" }).click();
  await waitFor(async () => (await getVault(id)).saved > before);
}
const vC = await getVault(id);
check(vC.saved === 300000n, `4. members contributed via the UI → pot $0.30 (saved=${vC.saved})`);
check(!(await pub.readContract({ address: SHARED, abi, functionName: "unlocked", args: [id] })), "4. still locked (below the $5 goal)");

// 5. Majority approve via the UI (owner + ana = 2 of 3)
for (const ctx of [O, A]) {
  await ctx.page.goto(`${BASE}/shared/${id}`, { waitUntil: "networkidle" });
  await ctx.page.waitForSelector("text=Unlock conditions");
  await ctx.page.waitForTimeout(2500);
  const before = (await getVault(id)).approvals;
  await ctx.page.getByRole("button", { name: "Approve early unlock" }).click();
  await waitFor(async () => (await getVault(id)).approvals > before);
}
check(await pub.readContract({ address: SHARED, abi, functionName: "unlocked", args: [id] }), "5. majority approval via the UI → unlocked");

// 6. Each withdraws their share via the UI
for (const ctx of [O, A, L]) {
  await ctx.page.goto(`${BASE}/shared/${id}`, { waitUntil: "networkidle" });
  await ctx.page.waitForSelector("text=Unlock conditions");
  await ctx.page.waitForTimeout(2500);
  const btn = ctx.page.getByRole("button", { name: /Withdraw my/ });
  if ((await btn.count()) > 0) {
    const before = (await getVault(id)).saved;
    await btn.click();
    await waitFor(async () => (await getVault(id)).saved < before);
  }
}
const vF = await getVault(id);
check(vF.saved === 0n && vF.closed, `6. all withdrew via the UI → vault closed (saved=${vF.saved})`);

const errs = [...O.errors, ...A.errors, ...L.errors];
check(errs.length === 0, `console/page errors: ${errs.length ? errs.join(" | ") : "none"}`);

await browser.close();
console.log(`\n===== ${pass.length} passed, ${fail.length} failed =====`);
if (fail.length) { console.log("FAILURES:\n" + fail.map((f) => " - " + f).join("\n")); process.exit(1); }
