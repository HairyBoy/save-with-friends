import Link from "next/link";

// Skeleton: Profile / Me — account hint, settings, legal, support.
export default function ProfileScreen() {
  return (
    <div className="flex flex-col gap-6 px-5 py-6">
      <header>
        <h1 className="text-xl font-bold">Me</h1>
        <p className="text-sm text-neutral-500">Mi perfil</p>
      </header>

      <section className="rounded-lg border border-neutral-200 p-4">
        <p className="text-sm font-medium">MiniPay account</p>
        <p className="text-sm text-neutral-500">[ address hint · 0x1234…abcd ]</p>
      </section>

      <section className="flex flex-col gap-2">
        <p className="rounded-lg border border-neutral-200 p-4 text-sm">Settings</p>
        <p className="rounded-lg border border-neutral-200 p-4 text-sm">Terms & Privacy</p>
        <p className="rounded-lg border border-neutral-200 p-4 text-sm">Support</p>
      </section>

      <Link href="/onboarding" className="text-center text-sm text-neutral-400 underline">
        View onboarding
      </Link>
    </div>
  );
}
