import Link from "next/link";

// Skeleton: My PiggyBanks (home). Plain-text placeholders — design + real data later.
export default function MyPiggyBanksScreen() {
  // Stubbed list so navigation into the detail screen is wired up.
  const piggyBanks = [
    { id: "1", name: "Trip to Cartagena" },
    { id: "2", name: "New laptop" },
  ];

  return (
    <div className="flex flex-col gap-6 px-5 py-6">
      <header>
        <h1 className="text-xl font-bold">My PiggyBanks</h1>
        <p className="text-sm text-neutral-500">Mis Alcancías</p>
      </header>

      <section className="rounded-lg border border-neutral-200 p-4">
        <p className="text-sm text-neutral-500">Total saved</p>
        <p className="text-2xl font-semibold">[ total amount ]</p>
      </section>

      <section className="rounded-lg border border-neutral-200 p-4">
        <p className="text-sm font-medium">Agent's daily update</p>
        <p className="text-sm text-neutral-500">[ what the agent did today + why ]</p>
      </section>

      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium">Your PiggyBanks</p>
        {piggyBanks.map((pb) => (
          <Link
            key={pb.id}
            href={`/piggybank/${pb.id}`}
            className="rounded-lg border border-neutral-200 p-4 text-sm"
          >
            🐷 {pb.name} <span className="text-neutral-400">→ details</span>
          </Link>
        ))}
        <Link
          href="/create"
          className="rounded-lg border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-500"
        >
          ➕ Create a PiggyBank
        </Link>
      </section>
    </div>
  );
}
