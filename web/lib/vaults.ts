// Data-access layer for Vaults.
//
// Stubbed with fake data for now, BUT every function is async (Promise-returning)
// so the real implementation can drop in on-chain reads (viem against the
// savings-lock contract) or a backend without touching any call site. UI-facing
// types use plain numbers (human USD); the future on-chain impl will read raw
// bigints and `formatUnits` them here, hiding chain details from the UI.
//
// A `userAddress` will be threaded in later (from `useMiniPay`) once reads are
// scoped to the connected wallet; the stub is the same for everyone for now.

export type VaultCurrency = "USD";

export type SplitMode = "equal" | "contribution";

// The current user's id within a shared vault's member list.
export const CURRENT_USER_ID = "me";

export type VaultMember = {
  id: string; // friend id; the current user is CURRENT_USER_ID
  name: string;
  contributed: number; // how much this member has put in
  accepted: boolean; // false = invited but hasn't joined yet
};

export type Vault = {
  id: string;
  name: string;
  icon: string; // emoji chosen at creation
  goal: number; // target amount (the shared goal, for shared vaults)
  saved: number; // currently locked (for shared = sum of member contributions)
  currency: VaultCurrency;
  deadline: string | null; // ISO yyyy-mm-dd unlock date (the timer); null = no timer
  yieldEarned: number; // earned by the agent while locked
  createdAt: string; // ISO yyyy-mm-dd
  shared: boolean;
  keyholders?: string[]; // solo: friend ids who can approve an early unlock
  // Shared-only:
  splitMode?: SplitMode; // how funds split when the vault unlocks
  members?: VaultMember[]; // contributors (incl. the owner); all must unlock
  inviteStatus?: "accepted" | "pending"; // current user's status on this shared vault
  ownerName?: string; // who created it / sent the invite (shown on pending)
};

export type SavingsSummary = {
  currentlySaving: number; // sum locked across active vaults right now
  savedAllTime: number; // cumulative ever saved (incl. past/completed vaults)
  currency: VaultCurrency;
};

export type DailyPrize = {
  amountCopm: number; // prize pool, paid in COPm
  winChancePct: number; // this user's chance of winning today
  yourEntries: number; // your raffle entries (1 per $1 locked today)
  totalEntries: number; // everyone's entries today
};

export type Friend = { id: string; name: string };

// --- Fake data (mirrors what the UI showed, with realistic numbers) ---------

const FAKE_FRIENDS: Friend[] = [
  { id: "ana", name: "Ana" },
  { id: "luis", name: "Luis" },
];

let FAKE_VAULTS: Vault[] = [
  {
    id: "1",
    name: "Trip to Cartagena",
    icon: "✈️",
    goal: 500,
    saved: 320,
    currency: "USD",
    deadline: "2026-09-01",
    keyholders: ["ana"],
    yieldEarned: 4.2,
    createdAt: "2026-05-10",
    shared: false,
  },
  {
    id: "2",
    name: "New laptop",
    icon: "💻",
    goal: 1200,
    saved: 450,
    currency: "USD",
    deadline: "2026-12-15",
    keyholders: ["luis"],
    yieldEarned: 6.85,
    createdAt: "2026-04-22",
    shared: false,
  },
  {
    id: "3",
    name: "Beach house",
    icon: "🏠",
    goal: 2000,
    saved: 700,
    currency: "USD",
    deadline: "2027-01-15",
    yieldEarned: 12.4,
    createdAt: "2026-05-01",
    shared: true,
    splitMode: "contribution",
    ownerName: "You",
    inviteStatus: "accepted",
    members: [
      { id: CURRENT_USER_ID, name: "You", contributed: 300, accepted: true },
      { id: "ana", name: "Ana", contributed: 250, accepted: true },
      { id: "luis", name: "Luis", contributed: 150, accepted: true },
    ],
  },
  {
    id: "4",
    name: "Sofía's birthday gift",
    icon: "🎁",
    goal: 300,
    saved: 150,
    currency: "USD",
    deadline: "2026-08-20",
    yieldEarned: 1.1,
    createdAt: "2026-06-02",
    shared: true,
    splitMode: "equal",
    ownerName: "Ana",
    inviteStatus: "pending",
    members: [
      { id: "ana", name: "Ana", contributed: 90, accepted: true },
      { id: "luis", name: "Luis", contributed: 60, accepted: true },
      { id: CURRENT_USER_ID, name: "You", contributed: 0, accepted: false },
    ],
  },
];

// --- "API" — async so the swap to real chain/backend reads is drop-in -------

export async function getVaults(): Promise<Vault[]> {
  return FAKE_VAULTS;
}

export async function getVault(id: string): Promise<Vault | null> {
  return FAKE_VAULTS.find((v) => v.id === id) ?? null;
}

// The current user's own stake in a vault: the full amount for a solo vault,
// their member contribution for an accepted shared vault, nothing for a pending
// invite (you haven't joined yet).
function myAmount(v: Vault): number {
  if (!v.shared) return v.saved;
  if (v.inviteStatus !== "accepted") return 0;
  return v.members?.find((m) => m.id === CURRENT_USER_ID)?.contributed ?? 0;
}

export async function getSavingsSummary(): Promise<SavingsSummary> {
  const vaults = await getVaults();
  const currentlySaving = vaults.reduce((sum, v) => sum + myAmount(v), 0);
  // Lifetime total also counts past/completed vaults (stubbed extra for now).
  const savedAllTime = currentlySaving + 1080;
  return { currentlySaving, savedAllTime, currency: "USD" };
}

// Today's weighted-raffle prize (COPm). 1 entry per $1 locked today; stubbed.
export async function getDailyPrize(): Promise<DailyPrize> {
  const yourEntries = 320;
  const totalEntries = 1780;
  return {
    amountCopm: 4000,
    winChancePct: Math.round((yourEntries / totalEntries) * 100),
    yourEntries,
    totalEntries,
  };
}

export async function getFriends(): Promise<Friend[]> {
  return FAKE_FRIENDS;
}

export type NewVaultInput = {
  name: string;
  icon: string;
  goal: number;
  deposit: number; // the creator's starting amount
  deadline: string | null;
  shared: boolean;
  splitMode: SplitMode;
  friendIds: string[]; // solo: keyholders · shared: invited members
};

let nextVaultId = 100;

// Create a vault. The stub appends to the in-memory list (survives navigation,
// resets on reload), so a vault you create shows up on the home screen.
export async function createVault(input: NewVaultInput): Promise<Vault> {
  const base = {
    id: String(nextVaultId++),
    name: input.name,
    icon: input.icon,
    goal: input.goal,
    saved: input.deposit,
    currency: "USD" as const,
    deadline: input.deadline,
    yieldEarned: 0,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  const vault: Vault = input.shared
    ? {
        ...base,
        shared: true,
        splitMode: input.splitMode,
        ownerName: "You",
        inviteStatus: "accepted",
        members: [
          { id: CURRENT_USER_ID, name: "You", contributed: input.deposit, accepted: true },
          ...input.friendIds.map((fid) => ({
            id: fid,
            name: FAKE_FRIENDS.find((f) => f.id === fid)?.name ?? fid,
            contributed: 0,
            accepted: false,
          })),
        ],
      }
    : { ...base, shared: false, keyholders: input.friendIds };
  FAKE_VAULTS = [...FAKE_VAULTS, vault];
  return vault;
}

// Accept a pending shared-vault invite (you become an accepted member).
export async function acceptInvite(id: string): Promise<void> {
  const vault = FAKE_VAULTS.find((v) => v.id === id);
  if (vault?.shared && vault.inviteStatus === "pending") {
    vault.inviteStatus = "accepted";
    const me = vault.members?.find((m) => m.id === CURRENT_USER_ID);
    if (me) me.accepted = true;
  }
}

// Decline a pending invite (drop it from your list).
export async function declineInvite(id: string): Promise<void> {
  FAKE_VAULTS = FAKE_VAULTS.filter((v) => v.id !== id);
}
