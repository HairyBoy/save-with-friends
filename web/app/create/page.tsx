import Link from "next/link";

// Skeleton: Create a PiggyBank (full-screen flow, no tab bar).
// Real flow later: name → target amount → deadline → accountability friends.
export default function CreatePiggyBankScreen() {
  return (
    <div className="flex min-h-dvh flex-col gap-6 px-5 py-6">
      <Link href="/" className="text-sm text-neutral-400">
        ← Cancel
      </Link>

      <header>
        <h1 className="text-xl font-bold">Create a PiggyBank</h1>
        <p className="text-sm text-neutral-500">Crear una Alcancía</p>
      </header>

      <section className="flex flex-col gap-3">
        <p className="rounded-lg border border-neutral-200 p-4 text-sm">
          Step 1 · [ name your PiggyBank ]
        </p>
        <p className="rounded-lg border border-neutral-200 p-4 text-sm">
          Step 2 · [ target amount ]
        </p>
        <p className="rounded-lg border border-neutral-200 p-4 text-sm">
          Step 3 · [ deadline / timer ]
        </p>
        <p className="rounded-lg border border-neutral-200 p-4 text-sm">
          Step 4 · [ pick accountability friends ]
        </p>
      </section>

      <button
        type="button"
        className="mt-auto rounded-lg bg-neutral-900 p-4 text-center text-sm font-medium text-white"
      >
        Create PiggyBank
      </button>
    </div>
  );
}
