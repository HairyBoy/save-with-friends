import Link from "next/link";

// Skeleton: Onboarding / Welcome (first run). MiniPay connects with zero clicks,
// so this is a value-prop splash, not a login form.
export default function OnboardingScreen() {
  return (
    <div className="flex min-h-dvh flex-col gap-6 px-5 py-10">
      <div className="flex flex-1 flex-col justify-center gap-4 text-center">
        <p className="text-5xl">🐷</p>
        <h1 className="text-2xl font-bold">Save with Friends</h1>
        <p className="text-sm text-neutral-500">Ahorra con Amigos</p>
        <p className="text-sm text-neutral-500">
          [ value prop: lock money in a PiggyBank toward a goal, earn while you wait, and
          save together with friends ]
        </p>
      </div>

      <Link
        href="/"
        className="rounded-lg bg-neutral-900 p-4 text-center text-sm font-medium text-white"
      >
        Get started
      </Link>
    </div>
  );
}
