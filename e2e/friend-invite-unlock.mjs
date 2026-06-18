// Adversarial testnet e2e for the invite-link friends flow + keyholder self-unlock.
//
// Three wallets, each in its own browser context with a mock MiniPay provider:
//   OWNER (Mateo) — sets name, invites, creates a vault, withdraws.
//   ANA           — accepts the invite (mutual friendship), then approves as keyholder.
//   LUIS          — a stranger (never invited): viewer-only + on-chain revert.
//
// Flow: OWNER sets name → mints invite → ANA opens link + sets name + accepts →
// mutual friendship (by name, no addresses) → OWNER creates a below-goal vault with
// ANA as keyholder → role checks → ANA approves from her own wallet → OWNER withdraws.

import { chromium } from "playwright";
import { createWalletClient, createPublicClient, http } from "viem";
import { celoSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { neon } from "@neondatabase/serverless";

// Direct DB access (same DATABASE_URL the app uses) — only to fabricate an expired
// invite, which can't be produced through the API.
const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

const BASE = process.env.BASE || "http://localhost:7951";
const RPC = "https://celo-sepolia.g.alchemy.com/v2/9oLIyDqxy32UaruybQQhA";
const ADAPTER = "0xbf1441Ea57f43f35f713431001f35742c88071c7";
const VAULT = "0x54fc67b6f9f8b0111c1c86037c075efc30b1a20c";
const KEYS = {
  owner: "0x9384fe73a181423efb23b012eb53c85679e3c7a81468a573604800002060f6d7",
  ana: "0x906bd0aa48b2a9720ebe9671238186a4d7aafaf85be5d42d8bb0eecb9786499a",
  luis: "0x8bc207cbbd8dec237e9c1a56894d8b5d0a1f40856b50d2f573685c6dd02237c6",
};
const abi = [
  { type: "function", name: "getOwnerVaults", inputs: [{ type: "address" }], outputs: [{ type: "uint256[]" }], stateMutability: "view" },
  { type: "function", name: "getKeyholders", inputs: [{ type: "uint256" }], outputs: [{ type: "address[]" }], stateMutability: "view" },
  { type: "function", name: "unlocked", inputs: [{ type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "function", name: "approveEarlyExit", inputs: [{ type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "getVault", inputs: [{ type: "uint256" }], outputs: [{ type: "tuple", components: [{ name: "owner", type: "address" }, { name: "deadline", type: "uint64" }, { name: "closed", type: "bool" }, { name: "goal", type: "uint256" }, { name: "saved", type: "uint256" }, { name: "approvals", type: "uint32" }, { name: "threshold", type: "uint32" }] }], stateMutability: "view" },
];
const accounts = {
  owner: privateKeyToAccount(KEYS.owner),
  ana: privateKeyToAccount(KEYS.ana),
  luis: privateKeyToAccount(KEYS.luis),
};
const pub = createPublicClient({ chain: celoSepolia, transport: http(RPC) });
const wallets = Object.fromEntries(
  Object.entries(accounts).map(([k, account]) => [k, createWalletClient({ account, chain: celoSepolia, transport: http(RPC) })]),
);

let rid = 1;
async function rpc(m, p) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: rid++, method: m, params: p ?? [] }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}
const api = (path) => fetch(`${BASE}${path}`).then((r) => r.json());

const pass = [];
const fail = [];
function check(cond, msg) {
  (cond ? pass : fail).push(msg);
  console.log(`${cond ? "✓" : "✗ FAIL"}  ${msg}`);
}

const browser = await chromium.launch();
async function mkPage(who) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const acct = accounts[who];
  const w = wallets[who];
  await ctx.exposeFunction("__walletRequest", async ({ method, params }) => {
    if (method === "eth_chainId") return "0xaa044c";
    if (method === "eth_accounts" || method === "eth_requestAccounts") return [acct.address];
    if (method === "eth_sendTransaction") {
      const t = params[0];
      return await w.sendTransaction({ to: t.to, data: t.data, value: t.value ? BigInt(t.value) : 0n, feeCurrency: t.feeCurrency ?? ADAPTER });
    }
    return rpc(method, params);
  });
  await ctx.addInitScript(() => {
    window.ethereum = { isMiniPay: true, request: (a) => window.__walletRequest(a), on: () => {}, removeListener: () => {} };
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

const ownerLc = accounts.owner.address.toLowerCase();
const anaLc = accounts.ana.address.toLowerCase();
const luisLc = accounts.luis.address.toLowerCase();
const NO_NAME_ADDR = "0x00000000000000000000000000000000deadbeef"; // never given a name
const INJ_ADDR = "0x00000000000000000000000000000000deadbee2"; // for the injection round-trip
const post = (path, body) =>
  fetch(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// --- 1. INVITE FLOW: OWNER sets name + invites; ANA accepts → mutual friendship ----
const O = await mkPage("owner");
const A = await mkPage("ana");

// First run: onboarding (pick language + set display name). Home is gated to here.
await O.page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
await O.page.waitForTimeout(1500); // let the mock wallet auto-connect
await O.page.fill("#ob-name", "Mateo");
await O.page.getByRole("button", { name: "Get started" }).click();
await O.page.waitForURL(`${BASE}/`, { timeout: 30000 });
const ownerName = await api(`/api/users?addresses=${ownerLc}`);
check(ownerName[ownerLc] === "Mateo", "1. OWNER onboarded + set display name 'Mateo' (saved from onboarding)");

// Mint an invite (the Friends "Invite" button wraps this + a native share sheet).
const mint = await (await fetch(`${BASE}/api/invite`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ inviter: accounts.owner.address }) })).json();
check(Boolean(mint.token), `1. OWNER minted an invite link (token ${mint.token})`);

// ANA opens the link, sees who invited her, sets her name, accepts.
await A.page.goto(`${BASE}/invite/${mint.token}`, { waitUntil: "networkidle" });
await A.page.waitForSelector("text=Mateo", { timeout: 20000 });
check((await A.page.locator("text=Mateo").count()) > 0, "1. ANA sees 'Mateo' on the invite (name, not address)");
await A.page.fill("#invite-name", "Ana");
await A.page.getByRole("button", { name: "Accept & connect" }).click();
await A.page.waitForSelector('button:has-text("Go to Friends")', { timeout: 30000 });
check(true, "1. ANA accepted the invite");

// Mutual friendship, by name, in the DB.
const aFriends = await api(`/api/friends?owner=${ownerLc}`);
const bFriends = await api(`/api/friends?owner=${anaLc}`);
check(aFriends.some((f) => f.address.toLowerCase() === anaLc && f.name === "Ana"), "1. OWNER's list has Ana (by name)");
check(bFriends.some((f) => f.address.toLowerCase() === ownerLc && f.name === "Mateo"), "1. ANA's list has Mateo (mutual, by name)");

// OWNER's Friends UI shows Ana by name and NO address.
await O.page.goto(`${BASE}/friends`, { waitUntil: "networkidle" });
await O.page.waitForSelector("text=Ana", { timeout: 15000 });
check((await O.page.locator("text=Ana").count()) > 0, "1. OWNER's Friends tab shows 'Ana'");
check((await O.page.locator(`text=${accounts.ana.address.slice(0, 6)}`).count()) === 0, "1. no 0x address shown in the Friends UI");

// --- create a below-goal vault with ANA as keyholder (picked from friends) ----
await O.page.goto(`${BASE}/create`, { waitUntil: "networkidle" });
await O.page.fill("#v-name", "Invite unlock");
await O.page.fill("#v-goal", "10");
await O.page.fill("#v-deposit", "1");
await O.page.click('button:has-text("1 week")');
const anaChip = O.page.locator('button[aria-pressed]:has-text("Ana")');
await anaChip.click();
check((await anaChip.getAttribute("aria-pressed")) === "true", "1. Ana (from invite) selectable as keyholder");
await O.page.click('button[type="submit"]:has-text("Create Vault")');
await O.page.waitForURL(`${BASE}/`, { timeout: 120000 });

const ids = await pub.readContract({ address: VAULT, abi, functionName: "getOwnerVaults", args: [accounts.owner.address] });
const id = ids[ids.length - 1];
const ks = await pub.readContract({ address: VAULT, abi, functionName: "getKeyholders", args: [id] });
check(ks.length === 1 && ks[0].toLowerCase() === anaLc, `1. on-chain keyholder of vault #${id} is Ana`);
check(!(await pub.readContract({ address: VAULT, abi, functionName: "unlocked", args: [id] })), `1. vault #${id} starts LOCKED`);
const url = `${BASE}/vault/${id}`;

// --- 2. ADVERSARIAL: OWNER on own vault — no 'Approve unlock' ----
await O.page.goto(url, { waitUntil: "networkidle" });
await O.page.waitForSelector("text=Unlock Conditions");
check(await O.page.getByRole("button", { name: "Deposit" }).isVisible(), "2. OWNER sees Deposit on own vault");
check((await O.page.getByRole("button", { name: "Approve unlock", exact: true }).count()) === 0, "2. OWNER does NOT see 'Approve unlock' (can't self-approve)");

// --- 3. ADVERSARIAL: LUIS (never invited) — viewer-only + on-chain revert ----
const L = await mkPage("luis");
await L.page.goto(url, { waitUntil: "networkidle" });
await L.page.waitForSelector("text=Unlock Conditions");
check((await L.page.locator("text=viewing a friend's vault").count()) > 0, "3. LUIS (non-keyholder) sees the read-only viewer note");
check((await L.page.getByRole("button", { name: "Approve unlock", exact: true }).count()) === 0, "3. LUIS does NOT see 'Approve unlock'");
let luisReverted = false;
try {
  await pub.simulateContract({ address: VAULT, abi, functionName: "approveEarlyExit", args: [id], account: accounts.luis.address });
} catch {
  luisReverted = true;
}
check(luisReverted, "3. a direct approveEarlyExit by LUIS reverts on-chain");

// --- 4. ANA (keyholder via invite) approves from her own wallet ----
await A.page.goto(url, { waitUntil: "networkidle" });
await A.page.waitForSelector("text=Unlock Conditions");
const anaApprove = A.page.getByRole("button", { name: "Approve unlock", exact: true });
check(await anaApprove.isVisible(), "4. ANA (keyholder) sees the real 'Approve unlock' button");
check((await A.page.locator("text=Invite unlock").count()) > 0, "4. ANA sees the owner's vault NAME 'Invite unlock' (synced via DB)");
await anaApprove.click();
await A.page.waitForSelector("text=thanks for approving", { timeout: 120000 });
const vA = await pub.readContract({ address: VAULT, abi, functionName: "getVault", args: [id] });
check(vA.approvals === 1 && (await pub.readContract({ address: VAULT, abi, functionName: "unlocked", args: [id] })), `4. after Ana's self-approve: approvals=${vA.approvals}, unlocked ✓`);

// --- 5. ADVERSARIAL: already-unlocked + idempotent re-approve ----
await A.page.reload({ waitUntil: "networkidle" });
await A.page.waitForSelector("text=Unlock Conditions");
check((await A.page.locator("text=thanks for approving").count()) > 0, "5. ANA reloading sees 'Unlocked — thanks for approving'");
check((await A.page.getByRole("button", { name: "Approve unlock", exact: true }).count()) === 0, "5. the 'Approve unlock' button is gone once unlocked");
const h2 = await wallets.ana.writeContract({ address: VAULT, abi, functionName: "approveEarlyExit", args: [id], feeCurrency: ADAPTER });
await pub.waitForTransactionReceipt({ hash: h2 });
const vDbl = await pub.readContract({ address: VAULT, abi, functionName: "getVault", args: [id] });
check(vDbl.approvals === 1, `5. a redundant approve by ANA is an idempotent no-op (approvals still ${vDbl.approvals})`);

// --- 6. OWNER withdraws (recover funds) ----
await O.page.goto(url, { waitUntil: "networkidle" });
await O.page.waitForSelector("text=Unlock Conditions");
await O.page.click('div.mt-auto > button:has-text("Withdraw")');
await O.page.waitForURL(`${BASE}/`, { timeout: 120000 });
await new Promise((r) => setTimeout(r, 4000));
const vF = await pub.readContract({ address: VAULT, abi, functionName: "getVault", args: [id] });
check(vF.closed && vF.saved === 0n, `6. OWNER withdrew — vault closed=${vF.closed} (deposit recovered)`);

// --- 7. ADVERSARIAL: invite / identity edge cases ----
// invalid token → accept screen shows the "invalid" state.
await L.page.goto(`${BASE}/invite/not-a-real-token-xyz`, { waitUntil: "networkidle" });
await L.page.waitForSelector("text=invalid", { timeout: 15000 });
check((await L.page.locator("text=invalid").count()) > 0, "7. invalid invite token shows the 'invalid' screen");

// accepting your OWN invite is rejected.
const selfMint = await (await post("/api/invite", { inviter: accounts.owner.address })).json();
const selfRes = await post(`/api/invite/${selfMint.token}`, { invitee: accounts.owner.address, inviteeName: "Mateo" });
check(selfRes.status === 400, `7. accepting your own invite is rejected (${selfRes.status})`);

// minting an invite with no display name set is blocked (409).
const noNameMint = await post("/api/invite", { inviter: NO_NAME_ADDR });
check(noNameMint.status === 409, `7. minting without a name set is blocked (${noNameMint.status})`);

// re-accepting the same invite is idempotent — no duplicate friendship.
await post(`/api/invite/${mint.token}`, { invitee: accounts.ana.address, inviteeName: "Ana" });
const dup = (await api(`/api/friends?owner=${ownerLc}`)).filter((f) => f.address.toLowerCase() === anaLc);
check(dup.length === 1, `7. re-accepting is idempotent — no duplicate friendship (${dup.length} edge)`);

// one link works for MANY friends: LUIS taps the SAME link → also befriended.
await post(`/api/invite/${mint.token}`, { invitee: accounts.luis.address, inviteeName: "Luis" });
check(
  (await api(`/api/friends?owner=${ownerLc}`)).some((f) => f.address.toLowerCase() === luisLc && f.name === "Luis"),
  "7. one invite link works for multiple friends (Luis joined via the same link)",
);

// a name change propagates (names resolve from users at read time).
await post("/api/users", { address: accounts.ana.address, displayName: "Ana V2" });
check(
  (await api(`/api/friends?owner=${ownerLc}`)).some((f) => f.address.toLowerCase() === anaLc && f.name === "Ana V2"),
  "7. a friend's name change propagates to everyone's list",
);
await post("/api/users", { address: accounts.ana.address, displayName: "Ana" });

// names are parameterized: an injection string round-trips and the table survives.
const inj = "x'); drop table users;-- <b>";
await post("/api/users", { address: INJ_ADDR, displayName: inj });
check((await api(`/api/users?addresses=${INJ_ADDR}`))[INJ_ADDR.toLowerCase()] === inj, "7. injection string stored verbatim (parameterized)");
check((await api(`/api/users?addresses=${ownerLc}`))[ownerLc] === "Mateo", "7. users table intact after injection attempt");

// HTML in a name is ESCAPED in the DOM (no stored XSS).
await post("/api/users", { address: accounts.ana.address, displayName: "<b>BOLD</b>" });
await O.page.goto(`${BASE}/friends`, { waitUntil: "networkidle" });
await O.page.waitForSelector("text=BOLD", { timeout: 15000 });
check((await O.page.content()).includes("&lt;b&gt;BOLD&lt;/b&gt;"), "7. HTML in a name is escaped in the DOM (no XSS)");
await post("/api/users", { address: accounts.ana.address, displayName: "Ana" });

// Expired invite → reported expired (GET), accept rejected (410), UI shows expired.
if (sql) {
  const expiredToken = "e2e-expired-token";
  await sql`insert into invites (token, inviter_address, expires_at)
    values (${expiredToken}, ${ownerLc}, now() - interval '1 day')
    on conflict (token) do update set expires_at = now() - interval '1 day'`;
  check((await api(`/api/invite/${expiredToken}`)).expired === true, "7. expired invite reports expired (GET)");
  const expAccept = await post(`/api/invite/${expiredToken}`, { invitee: accounts.ana.address, inviteeName: "Ana" });
  check(expAccept.status === 410, `7. accepting an expired invite is rejected (${expAccept.status})`);
  await L.page.goto(`${BASE}/invite/${expiredToken}`, { waitUntil: "networkidle" });
  await L.page.waitForSelector("text=expired", { timeout: 15000 });
  check((await L.page.locator("text=expired").count()) > 0, "7. expired invite shows the 'expired' screen");
} else {
  check(false, "7. expired-invite test SKIPPED (no DATABASE_URL)");
}

// Cleanup: drop the test friendships (idempotent on re-run anyway).
await fetch(`${BASE}/api/friends`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ owner: accounts.owner.address, address: accounts.ana.address }) });
await fetch(`${BASE}/api/friends`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ owner: accounts.owner.address, address: accounts.luis.address }) });

const allErrors = [...O.errors, ...A.errors, ...L.errors];
check(allErrors.length === 0, `console/page errors: ${allErrors.length ? allErrors.join(" | ") : "none"}`);

await browser.close();
console.log(`\n===== ${pass.length} passed, ${fail.length} failed =====`);
if (fail.length) {
  console.log("FAILURES:\n" + fail.map((f) => " - " + f).join("\n"));
  process.exit(1);
}
