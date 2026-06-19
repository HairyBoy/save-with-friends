// Reclaim USDC stranded in dangling SharedVaults (#1, #2) from failed test runs:
// owner + ana majority-approve (2-of-3 → unlock), then each withdraws their share.
import { createWalletClient, createPublicClient, http } from "viem";
import { celoSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const RPC = "https://celo-sepolia.g.alchemy.com/v2/9oLIyDqxy32UaruybQQhA";
const SHARED = "0xFA72C790C970F2bB76994E6a88219B4F420433e9";
const ADAPTER = "0xbf1441Ea57f43f35f713431001f35742c88071c7";
const abi = [
  { type: "function", name: "approveEarlyExit", inputs: [{ type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "withdraw", inputs: [{ type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "unlocked", inputs: [{ type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "function", name: "contributionOf", inputs: [{ type: "uint256" }, { type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getVault", inputs: [{ type: "uint256" }], outputs: [{ type: "tuple", components: [
    { name: "owner", type: "address" }, { name: "deadline", type: "uint64" }, { name: "closed", type: "bool" },
    { name: "payout", type: "uint8" }, { name: "goalReached", type: "bool" }, { name: "goal", type: "uint256" },
    { name: "saved", type: "uint256" }, { name: "approvals", type: "uint32" }, { name: "memberCount", type: "uint32" }] }], stateMutability: "view" },
];
const acc = { owner: privateKeyToAccount(process.env.OWNER_PK || process.env.TEST_USER_PK), ana: privateKeyToAccount(process.env.ANA_PK) };
const pub = createPublicClient({ chain: celoSepolia, transport: http(RPC) });
const w = { owner: createWalletClient({ account: acc.owner, chain: celoSepolia, transport: http(RPC) }), ana: createWalletClient({ account: acc.ana, chain: celoSepolia, transport: http(RPC) }) };
async function send(who, fn, args) {
  try {
    const hash = await w[who].writeContract({ address: SHARED, abi, functionName: fn, args, feeCurrency: ADAPTER });
    await pub.waitForTransactionReceipt({ hash });
    console.log(`  ${who} ${fn}(${args}) ok`);
  } catch (e) { console.log(`  ${who} ${fn}(${args}) skipped: ${String(e.message).split("\n")[0]}`); }
}
for (const id of [1n, 2n]) {
  const v = await pub.readContract({ address: SHARED, abi, functionName: "getVault", args: [id] });
  if (v.closed) { console.log(`vault #${id}: already closed`); continue; }
  console.log(`vault #${id}: saved=${v.saved} reclaiming…`);
  if (!(await pub.readContract({ address: SHARED, abi, functionName: "unlocked", args: [id] }))) {
    await send("owner", "approveEarlyExit", [id]);
    await send("ana", "approveEarlyExit", [id]);
  }
  for (const who of ["owner", "ana"]) {
    if ((await pub.readContract({ address: SHARED, abi, functionName: "contributionOf", args: [id, acc[who].address] })) > 0n) {
      await send(who, "withdraw", [id]);
    }
  }
}
console.log("done");
