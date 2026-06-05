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

export type Vault = {
  id: string;
  name: string;
  icon: string; // emoji chosen at creation
  goal: number; // target amount
  saved: number; // currently locked
  currency: VaultCurrency;
  deadline: string | null; // ISO yyyy-mm-dd unlock date (the timer); null = no timer
  keyholders: string[]; // friend ids who can approve an early unlock
  yieldEarned: number; // earned by the agent while locked
  createdAt: string; // ISO yyyy-mm-dd
};

export type SavingsSummary = {
  totalSaved: number;
  currency: VaultCurrency;
};

export type Friend = { id: string; name: string };

// --- Fake data (mirrors what the UI showed, with realistic numbers) ---------

const FAKE_FRIENDS: Friend[] = [
  { id: "ana", name: "Ana" },
  { id: "luis", name: "Luis" },
];

const FAKE_VAULTS: Vault[] = [
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
  },
];

// --- "API" — async so the swap to real chain/backend reads is drop-in -------

export async function getVaults(): Promise<Vault[]> {
  return FAKE_VAULTS;
}

export async function getVault(id: string): Promise<Vault | null> {
  return FAKE_VAULTS.find((v) => v.id === id) ?? null;
}

export async function getTotalSaved(): Promise<SavingsSummary> {
  const vaults = await getVaults();
  const totalSaved = vaults.reduce((sum, v) => sum + v.saved, 0);
  return { totalSaved, currency: "USD" };
}

export async function getFriends(): Promise<Friend[]> {
  return FAKE_FRIENDS;
}
