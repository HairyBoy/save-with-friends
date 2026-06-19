// Verify the shared-vault DRAFT assembly API against the running server + Neon:
// create → join (roster + mutual friendship) → self-join rejected → owner-remove →
// non-owner remove rejected → launch owner-check rejected for a non-owned vault.
//   (run with the prod server up on $BASE, and --env-file for the addresses)

const BASE = process.env.BASE || "http://localhost:7951";
const owner = (process.env.TEST_USER_ADDRESS || "0x44A6925B30da4Fcdbe73C514d52414b7d96c7132").toLowerCase();
const ana = (process.env.ANA_ADDRESS || "0xf84658EE8704269e863e9CF28dD38D4007dd2080").toLowerCase();
const stranger = "0x00000000000000000000000000000000deadbeef";

const post = (p, b) => fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const getJson = (p) => fetch(BASE + p).then((r) => r.json());

const pass = [], fail = [];
const check = (c, m) => { (c ? pass : fail).push(m); console.log(`${c ? "✓" : "✗ FAIL"}  ${m}`); };

const created = await post("/api/drafts", { owner, name: "Beach house", icon: "🏖️", goal: "100", deadlineDays: 30, payout: 0 });
const { draftId } = await created.json();
check(created.status === 200 && Boolean(draftId), `create draft → ${draftId}`);

let d = await getJson(`/api/drafts/${draftId}`);
check(d.owner === owner && d.members.some((m) => m.address === owner), "draft has the owner on the roster");

const joinRes = await post(`/api/drafts/${draftId}`, { action: "join", member: ana, memberName: "Ana" });
d = await getJson(`/api/drafts/${draftId}`);
check(joinRes.status === 200 && d.members.some((m) => m.address === ana && m.name === "Ana"), "ANA joined the roster (by name)");

const aFriends = await getJson(`/api/friends?owner=${ana}`);
check(Array.isArray(aFriends) && aFriends.some((f) => f.address.toLowerCase() === owner), "joining the draft befriended the owner (mutual)");

const selfJoin = await post(`/api/drafts/${draftId}`, { action: "join", member: owner, memberName: "Mateo" });
check(selfJoin.status === 400, `owner can't join their own draft as a member (${selfJoin.status})`);

const badRemove = await post(`/api/drafts/${draftId}`, { action: "remove", owner: stranger, member: ana });
check(badRemove.status === 403, `non-owner can't remove from the roster (${badRemove.status})`);

const remove = await post(`/api/drafts/${draftId}`, { action: "remove", owner, member: ana });
d = await getJson(`/api/drafts/${draftId}`);
check(remove.status === 200 && !d.members.some((m) => m.address === ana), "owner removed ANA from the roster");

const badLaunch = await post(`/api/drafts/${draftId}`, { action: "launch", owner, vaultId: "999999" });
check(badLaunch.status === 403 || badLaunch.status === 400, `launch rejected for a vault the owner doesn't own (${badLaunch.status})`);

console.log(`\n===== ${pass.length} passed, ${fail.length} failed =====`);
if (fail.length) process.exit(1);
