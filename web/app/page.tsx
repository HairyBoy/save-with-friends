"use client";

import { useMiniPay } from "@/hooks/useMiniPay";

// MiniPay "Add Cash" deeplink (use "Deposit" wording in the UI, per MiniPay rules).
const ADD_CASH = "https://link.minipay.xyz/add_cash?tokens=USDm,USDC,USDT";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function Home() {
  const { address, balances, isMiniPay, isLoading } = useMiniPay();

  const total = balances.reduce((sum, b) => sum + b.human, 0);
  const hasFunds = total > 0;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col gap-6 bg-white px-5 py-8 text-neutral-900">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Ahorra con Amigos</h1>
          <p className="text-xs text-neutral-500">Save with Friends</p>
        </div>
        {address && (
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] text-neutral-500">
            {short(address)}
          </span>
        )}
      </header>

      {isLoading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : !isMiniPay && !address ? (
        <OpenInMiniPay />
      ) : (
        <>
          <section className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white">
            <p className="text-xs opacity-80">Available to save</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{fmt(total)}</p>
            <p className="text-xs opacity-80">across your stablecoins</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-neutral-700">Your balances</h2>
            {balances.map((b) => (
              <div
                key={b.symbol}
                className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3"
              >
                <span className="text-sm font-medium">{b.label}</span>
                <span className="text-sm tabular-nums text-neutral-600">{fmt(b.human)}</span>
              </div>
            ))}
          </section>

          {!hasFunds && (
            <a
              href={ADD_CASH}
              className="rounded-xl bg-neutral-900 px-4 py-3 text-center text-sm font-medium text-white"
            >
              Deposit to get started
            </a>
          )}

          <button
            type="button"
            disabled
            className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Create a savings goal (coming next)
          </button>

          <p className="mt-auto text-center text-[11px] leading-relaxed text-neutral-400">
            Your savings earn yield in audited protocols while locked. Withdraw when your
            goal is reached, your timer ends, or a friend approves an early exit.
          </p>
        </>
      )}
    </main>
  );
}

function OpenInMiniPay() {
  return (
    <div className="rounded-2xl border border-neutral-200 p-5 text-sm text-neutral-600">
      <p className="font-medium text-neutral-900">Open in MiniPay</p>
      <p className="mt-1">
        This is a MiniPay Mini App. Open it inside MiniPay on your phone to connect
        automatically and start saving.
      </p>
    </div>
  );
}
