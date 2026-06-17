// Adversarial testnet e2e for Phase 1 friend-keys: a keyholder approves an early
// unlock from THEIR OWN connected wallet (the real path), plus role-based access.
//
// Three wallets (testnet), each in its own browser context with window.ethereum
// backed by that wallet's Node viem signer:
//   OWNER   — creates/owns the vault, withdraws.
//   ANA     — a keyholder; approves the early unlock from her own wallet.
//   LUIS    — a friend who is NOT a keyholder of this vault (the "stranger" case).
//
// All secrets come from the environment — nothing is hardcoded. Run it against a
// LOCAL server build of the app (see README.md) so it exercises the real UI wiring.
//
//   OWNER_PK (or TEST_USER_PK), ANA_PK, ANA_ADDRESS, LUIS_PK   — required
//   E2E_RPC (or CELO_SEPOLIA_RPC), E2E_VAULT (or
//     NEXT_PUBLIC_SAVINGS_VAULTS_ADDRESS), E2E_FEE_ADAPTER, BASE — optional

import { chromium } from "playwright";
import { createWalletClient, createPublicClient, http } from "viem";
import { celoSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const env = (...names) => names.map((n) => process.env[n]).find(Boolean);
const required = (val, name) => {
  if (!val) {
    console.error(`Missing required env var: ${name}. See e2e/README.md.`);
    process.exit(2);
  }
  return val;
};

const BASE = env("BASE") || "http://localhost:7951";
const RPC = env("E2E_RPC", "CELO_SEPOLIA_RPC") || "https://forno.celo-sepolia.celo-testnet.org";
const ADAPTER = env("E2E_FEE_ADAPTER") || "0xbf1441Ea57f43f35f713431001f35742c88071c7";
const VAULT = env("E2E_VAULT", "NEXT_PUBLIC_SAVINGS_VAULTS_ADDRESS") || "0x54fc67b6f9f8b0111c1c86037c075efc30b1a20c";

const KEYS = {
  owner: required(env("OWNER_PK", "TEST_USER_PK"), "OWNER_PK (or TEST_USER_PK)"),
  ana: required(env("ANA_PK"), "ANA_PK"),
  luis: required(env("LUIS_PK"), "LUIS_PK"),
};
const ANA_ADDRESS = required(env("ANA_ADDRESS"), "ANA_ADDRESS");

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

// --- 1. OWNER: add Ana as a friend, then create a below-goal vault with Ana key ---
const O = await mkPage("owner");
await O.page.goto(`${BASE}/friends`, { waitUntil: "networkidle" });
await O.page.fill('input[placeholder^="Nickname"]', "Ana");
await O.page.fill('input[placeholder^="Wallet address"]', ANA_ADDRESS);
await O.page.getByRole("button", { name: "Add friend" }).click();
await O.page.waitForSelector(`text=${ANA_ADDRESS.slice(0, 6)}…${ANA_ADDRESS.slice(-4)}`, { timeout: 15000 });
check(true, "1. OWNER added Ana as a friend by address (appears in list)");

await O.page.goto(`${BASE}/create`, { waitUntil: "networkidle" });
await O.page.fill("#v-name", "Self unlock");
await O.page.fill("#v-goal", "10");
await O.page.fill("#v-deposit", "1");
await O.page.click('button:has-text("1 week")');
const anaChip = O.page.locator('button[aria-pressed]:has-text("Ana")');
await anaChip.click();
check((await anaChip.getAttribute("aria-pressed")) === "true", "1. Ana selectable as keyholder from the friends list");
await O.page.click('button[type="submit"]:has-text("Create Vault")');
await O.page.waitForURL(`${BASE}/`, { timeout: 120000 });

const ids = await pub.readContract({ address: VAULT, abi, functionName: "getOwnerVaults", args: [accounts.owner.address] });
const id = ids[ids.length - 1];
const ks = await pub.readContract({ address: VAULT, abi, functionName: "getKeyholders", args: [id] });
const v0 = await pub.readContract({ address: VAULT, abi, functionName: "getVault", args: [id] });
check(ks.length === 1 && ks[0].toLowerCase() === ANA_ADDRESS.toLowerCase(), `1. on-chain keyholder of vault #${id} is Ana (${ks.map((a) => a.slice(0, 8))})`);
check(v0.saved === 1000000n && v0.goal === 10000000n, `1. vault #${id} funded $1, goal $10, below-goal (saved=${v0.saved})`);
check(!(await pub.readContract({ address: VAULT, abi, functionName: "unlocked", args: [id] })), `1. vault #${id} starts LOCKED (no unlock condition met)`);

const url = `${BASE}/vault/${id}`;

// --- 2. ADVERSARIAL: OWNER on their own vault sees owner actions, not Approve unlock ---
await O.page.goto(url, { waitUntil: "networkidle" });
await O.page.waitForSelector("text=Unlock Conditions");
check(await O.page.getByRole("button", { name: "Deposit" }).isVisible(), "2. OWNER sees Deposit on own vault");
check((await O.page.getByRole("button", { name: "Approve unlock", exact: true }).count()) === 0, "2. OWNER does NOT see 'Approve unlock' on own vault (can't self-approve)");

// --- 3. ADVERSARIAL: LUIS (not a keyholder) — viewer-only UI + on-chain revert ---
const L = await mkPage("luis");
await L.page.goto(url, { waitUntil: "networkidle" });
await L.page.waitForSelector("text=Unlock Conditions");
check((await L.page.locator("text=viewing a friend's vault").count()) > 0, "3. LUIS (non-keyholder) sees the read-only viewer note");
check((await L.page.getByRole("button", { name: "Approve unlock", exact: true }).count()) === 0, "3. LUIS does NOT see 'Approve unlock'");
check((await L.page.getByRole("button", { name: "Deposit" }).count()) === 0, "3. LUIS does NOT see Deposit");
let luisReverted = false;
try {
  await pub.simulateContract({ address: VAULT, abi, functionName: "approveEarlyExit", args: [id], account: accounts.luis.address });
} catch {
  luisReverted = true;
}
check(luisReverted, "3. a direct approveEarlyExit by LUIS reverts on-chain (contract bars non-keyholders)");

// --- 4. REAL PATH: ANA approves from her OWN wallet via the UI ---
const A = await mkPage("ana");
await A.page.goto(url, { waitUntil: "networkidle" });
await A.page.waitForSelector("text=Unlock Conditions");
const anaApprove = A.page.getByRole("button", { name: "Approve unlock", exact: true });
check(await anaApprove.isVisible(), "4. ANA (keyholder) sees the real 'Approve unlock' button");
check((await A.page.getByRole("button", { name: "Deposit" }).count()) === 0, "4. ANA does NOT see Deposit (she's not the owner)");
await anaApprove.click();
await A.page.waitForSelector("text=thanks for approving", { timeout: 120000 });
const vA = await pub.readContract({ address: VAULT, abi, functionName: "getVault", args: [id] });
const unlockedA = await pub.readContract({ address: VAULT, abi, functionName: "unlocked", args: [id] });
check(vA.approvals === 1 && unlockedA, `4. after Ana's self-approve: approvals=${vA.approvals}, unlocked=${unlockedA} ✓ (signed by Ana's own wallet)`);

// --- 5. ADVERSARIAL: already-unlocked UI + idempotent re-approval ---
await A.page.reload({ waitUntil: "networkidle" });
await A.page.waitForSelector("text=Unlock Conditions");
check((await A.page.locator("text=thanks for approving").count()) > 0, "5. ANA reloading sees 'Unlocked — thanks for approving'");
check((await A.page.getByRole("button", { name: "Approve unlock", exact: true }).count()) === 0, "5. the 'Approve unlock' button is gone once unlocked");
const h2 = await wallets.ana.writeContract({ address: VAULT, abi, functionName: "approveEarlyExit", args: [id], feeCurrency: ADAPTER });
await pub.waitForTransactionReceipt({ hash: h2 });
const vDbl = await pub.readContract({ address: VAULT, abi, functionName: "getVault", args: [id] });
check(vDbl.approvals === 1, `5. a redundant approve by ANA is an idempotent no-op (approvals still ${vDbl.approvals} — can't inflate threshold)`);

// --- 6. OWNER withdraws (recover funds) ---
await O.page.goto(url, { waitUntil: "networkidle" });
await O.page.waitForSelector("text=Unlock Conditions");
await O.page.click('div.mt-auto > button:has-text("Withdraw")');
await O.page.waitForURL(`${BASE}/`, { timeout: 120000 });
await new Promise((r) => setTimeout(r, 4000));
const vF = await pub.readContract({ address: VAULT, abi, functionName: "getVault", args: [id] });
check(vF.closed && vF.saved === 0n, `6. OWNER withdrew — vault closed=${vF.closed}, saved=${vF.saved} (deposit recovered)`);

const allErrors = [...O.errors, ...L.errors, ...A.errors];
check(allErrors.length === 0, `console/page errors: ${allErrors.length ? allErrors.join(" | ") : "none"}`);

await browser.close();
console.log(`\n===== ${pass.length} passed, ${fail.length} failed =====`);
if (fail.length) {
  console.log("FAILURES:\n" + fail.map((f) => " - " + f).join("\n"));
  process.exit(1);
}
