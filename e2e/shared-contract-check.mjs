// Adversarial exercise of the DEPLOYED SharedVaults on Celo Sepolia (not a local
// Foundry deploy) — validates the real ABI, fee abstraction (gas in USDC), conservation,
// and access control against the live contract. Pure viem (no UI), real wallets.
//
//   node --env-file=../web/.env.local --env-file=../contracts/.env.deployer shared-contract-check.mjs

import { createWalletClient, createPublicClient, http, getAddress } from "viem";
import { celoSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const RPC = "https://celo-sepolia.g.alchemy.com/v2/9oLIyDqxy32UaruybQQhA";
const SHARED = "0xFA72C790C970F2bB76994E6a88219B4F420433e9";
const USDC = "0x01C5C0122039549AD1493B8220cABEdD739BC44E";
const ADAPTER = "0xbf1441Ea57f43f35f713431001f35742c88071c7"; // USDC fee-currency adapter
const STRANGER = "0x00000000000000000000000000000000deadbeef";

const erc20 = [
  { type: "function", name: "approve", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "transfer", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "balanceOf", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
];
const abi = [
  { type: "function", name: "createVault", inputs: [{ type: "uint256" }, { type: "uint64" }, { type: "uint8" }, { type: "address[]" }, { type: "uint256" }], outputs: [{ type: "uint256" }], stateMutability: "nonpayable" },
  { type: "function", name: "deposit", inputs: [{ type: "uint256" }, { type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "approveEarlyExit", inputs: [{ type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "withdraw", inputs: [{ type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "unlocked", inputs: [{ type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "function", name: "contributionOf", inputs: [{ type: "uint256" }, { type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "nextId", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getVault", inputs: [{ type: "uint256" }], outputs: [{ type: "tuple", components: [
    { name: "owner", type: "address" }, { name: "deadline", type: "uint64" }, { name: "closed", type: "bool" },
    { name: "payout", type: "uint8" }, { name: "goalReached", type: "bool" }, { name: "goal", type: "uint256" },
    { name: "saved", type: "uint256" }, { name: "approvals", type: "uint32" }, { name: "memberCount", type: "uint32" }] }], stateMutability: "view" },
];

const acc = {
  owner: privateKeyToAccount(process.env.OWNER_PK || process.env.TEST_USER_PK),
  ana: privateKeyToAccount(process.env.ANA_PK),
  luis: privateKeyToAccount(process.env.LUIS_PK),
};
const pub = createPublicClient({ chain: celoSepolia, transport: http(RPC) });
const w = Object.fromEntries(Object.entries(acc).map(([k, account]) => [k, createWalletClient({ account, chain: celoSepolia, transport: http(RPC) })]));

const pass = [], fail = [];
const check = (c, m) => { (c ? pass : fail).push(m); console.log(`${c ? "✓" : "✗ FAIL"}  ${m}`); };
const usdc = (a) => pub.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [a] });
async function tx(who, address, fnAbi, functionName, args) {
  const hash = await w[who].writeContract({ address, abi: fnAbi, functionName, args, feeCurrency: ADAPTER });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status === "reverted") throw new Error(`${functionName} reverted`);
  return r;
}
const approveUsdc = (who, amt) => tx(who, USDC, erc20, "approve", [SHARED, amt]);
const getVault = (id) => pub.readContract({ address: SHARED, abi, functionName: "getVault", args: [id] });
const reverts = async (account, functionName, args) => {
  try { await pub.simulateContract({ address: SHARED, abi, functionName, args, account }); return false; }
  catch { return true; }
};

const ONE = 100_000n; // $0.10 USDC (6dp) — tiny deposits so the USDC gas reservation
//                        can't crowd out the transfer on these small test balances.
const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);

// Ensure both members have ample USDC for gas + the tiny deposits.
for (const who of ["ana", "luis"]) {
  if ((await usdc(acc[who].address)) < 500_000n) {
    console.log(`funding ${who} with 1 USDC for the run…`);
    await tx("owner", USDC, erc20, "transfer", [acc[who].address, 1_000_000n]);
  }
}

// ===== Phase A: BY_CONTRIBUTION, goal unlock, each withdraws own =====
const contractBalBefore = await usdc(SHARED);
await approveUsdc("owner", ONE);
await tx("owner", SHARED, abi, "createVault", [3n * ONE, deadline, 0, [acc.ana.address, acc.luis.address], ONE]);
const idA = (await pub.readContract({ address: SHARED, abi, functionName: "nextId" })) - 1n;
let vA = await getVault(idA);
check(vA.memberCount === 3 && vA.saved === ONE, `A. created by-contribution vault #${idA} (3 members, owner funded $1)`);

await approveUsdc("ana", ONE); await tx("ana", SHARED, abi, "deposit", [idA, ONE]);
check(await reverts(STRANGER, "deposit", [idA, ONE]), "A. stranger cannot deposit (reverts)");
await approveUsdc("luis", ONE); await tx("luis", SHARED, abi, "deposit", [idA, ONE]); // crosses $3 goal
vA = await getVault(idA);
check(vA.saved === 3n * ONE && (await pub.readContract({ address: SHARED, abi, functionName: "unlocked", args: [idA] })), "A. goal reached → unlocked");

const anaContribBefore = await pub.readContract({ address: SHARED, abi, functionName: "contributionOf", args: [idA, acc.ana.address] });
const anaBefore = await usdc(acc.ana.address);
await tx("ana", SHARED, abi, "withdraw", [idA]);
const anaContribAfter = await pub.readContract({ address: SHARED, abi, functionName: "contributionOf", args: [idA, acc.ana.address] });
const anaDelta = (await usdc(acc.ana.address)) - anaBefore;
check(anaContribBefore === ONE && anaContribAfter === 0n && anaDelta > 0n, `A. ANA withdrew her full share (contribution ${anaContribBefore}→0, funds received net of USDC gas)`);
check(await reverts(acc.ana.address, "withdraw", [idA]), "A. ANA cannot double-withdraw (reverts)");
await tx("luis", SHARED, abi, "withdraw", [idA]);
await tx("owner", SHARED, abi, "withdraw", [idA]);
vA = await getVault(idA);
check(vA.closed && vA.saved === 0n, "A. all withdrawn → vault closed, saved=0");
check((await usdc(SHARED)) === contractBalBefore, `A. conservation — contract USDC back to baseline (${contractBalBefore})`);

// ===== Phase B: OWNER_TAKES_ALL + majority approval =====
await tx("owner", SHARED, abi, "createVault", [100n * ONE, deadline, 1, [acc.ana.address, acc.luis.address], 0n]);
const idB = (await pub.readContract({ address: SHARED, abi, functionName: "nextId" })) - 1n;
await approveUsdc("ana", ONE); await tx("ana", SHARED, abi, "deposit", [idB, ONE]);
await approveUsdc("luis", ONE); await tx("luis", SHARED, abi, "deposit", [idB, ONE]);
check(!(await pub.readContract({ address: SHARED, abi, functionName: "unlocked", args: [idB] })), "B. below goal, before deadline → locked");
check(await reverts(STRANGER, "approveEarlyExit", [idB]), "B. stranger cannot approve (reverts)");

await tx("ana", SHARED, abi, "approveEarlyExit", [idB]);
check(!(await pub.readContract({ address: SHARED, abi, functionName: "unlocked", args: [idB] })), "B. 1 of 3 approvals → still locked");
await tx("luis", SHARED, abi, "approveEarlyExit", [idB]);
check(await pub.readContract({ address: SHARED, abi, functionName: "unlocked", args: [idB] }), "B. 2 of 3 (majority) → unlocked");

check(await reverts(acc.ana.address, "withdraw", [idB]), "B. non-owner cannot withdraw in owner-takes-all (reverts)");
const potBefore = (await getVault(idB)).saved;
const ownerBefore = await usdc(acc.owner.address);
await tx("owner", SHARED, abi, "withdraw", [idB]);
const ownerDelta = (await usdc(acc.owner.address)) - ownerBefore;
check(potBefore === 2n * ONE && (await getVault(idB)).saved === 0n && ownerDelta > 0n, `B. OWNER claimed the whole pot (pot ${potBefore}→0, funds received net of USDC gas)`);
check((await getVault(idB)).closed, "B. owner-takes-all vault closed after claim");

console.log(`\n===== ${pass.length} passed, ${fail.length} failed =====`);
if (fail.length) { console.log("FAILURES:\n" + fail.map((f) => " - " + f).join("\n")); process.exit(1); }
