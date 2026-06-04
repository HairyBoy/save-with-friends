import Link from "next/link";

// Skeleton: PiggyBank detail (full-screen push, no tab bar).
export default async function PiggyBankDetailScreen({
  params,
}: PageProps<"/piggybank/[id]">) {
  const { id } = await params;

  return (
    <div className="flex min-h-dvh flex-col gap-6 px-5 py-6">
      <Link href="/" className="text-sm text-neutral-400">
        ← My PiggyBanks
      </Link>

      <header>
        <h1 className="text-xl font-bold">PiggyBank #{id}</h1>
        <p className="text-sm text-neutral-500">[ name ]</p>
      </header>

      <section className="rounded-lg border border-neutral-200 p-4 text-center">
        <p className="text-sm text-neutral-500">[ pig filling up · progress ring ]</p>
        <p className="text-2xl font-semibold">[ saved / goal ]</p>
      </section>

      <section className="rounded-lg border border-neutral-200 p-4">
        <p className="text-sm font-medium">Unlocks when</p>
        <p className="text-sm text-neutral-500">🎯 goal reached</p>
        <p className="text-sm text-neutral-500">⏳ timer ends</p>
        <p className="text-sm text-neutral-500">🤝 a friend approves early exit</p>
      </section>

      <section className="rounded-lg border border-neutral-200 p-4">
        <p className="text-sm font-medium">Yield earned</p>
        <p className="text-sm text-neutral-500">[ earned while locked ]</p>
      </section>

      <div className="mt-auto flex flex-col gap-2">
        <button
          type="button"
          className="rounded-lg bg-neutral-900 p-4 text-center text-sm font-medium text-white"
        >
          Deposit
        </button>
        <button
          type="button"
          className="rounded-lg border border-neutral-200 p-4 text-center text-sm"
        >
          Request early exit
        </button>
      </div>
    </div>
  );
}
