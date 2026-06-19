**English** · [Español](README.es.md)

# Save with Friends · _Ahorra con Amigos_

A social savings **MiniPay Mini App** on [Celo](https://celo.org), built for the
**Hackathon de Agentes Onchain Colombia**.

> 🚧 Early in development — this README is an overview of what we're building. Details
> will fill in as the project takes shape.

---

## The idea

Saving money alone is hard. **Save with Friends** makes it social and keeps you honest:
you set a goal, lock your stablecoins, and your savings stay locked until you actually
reach it — with friends along for the ride to help you stay on track.

The twist: while your money sits locked, it doesn't sit idle. We're exploring how an
**onchain AI agent** can put those savings to work for you in the background, so waiting
to reach your goal earns you something along the way.

We're building this on **Celo** with **MiniPay**, using stablecoins — including
**COPm** (the Celo Colombian Peso) — so it's practical for everyday saving.

---

## Why we're building it

This is our entry for the **Hackathon de Agentes Onchain Colombia** — a hackathon
focused on onchain AI agents and stablecoins. We wanted something that's genuinely
useful to everyday people, mobile-first via MiniPay, and a real showcase of what an
onchain agent can do with money.

---

## Stack

- **Frontend** — Next.js 16 + Tailwind, [viem](https://viem.sh). In [`web/`](web/).
- **Chain** — Celo (mainnet `42220` / Sepolia testnet `11142220`).
- **Wallet** — MiniPay (zero-click connect via `window.ethereum`).
- **Currency** — stablecoins, with first-class support for **COPm** (Celo Colombian Peso).

---

## Getting started

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To test inside MiniPay on a real
device, expose the dev server with a tunnel (e.g. ngrok) and open the URL in the
MiniPay site tester.

---

## Deploying the daily raffle

The daily COPm raffle runs on **Vercel Cron** (see [`web/vercel.json`](web/vercel.json):
the draw fires at `17:00 UTC` = noon Bogotá, the payout 5 minutes later). For it to run
in production, set these env vars (full list in [`web/.env.example`](web/.env.example)):

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres — stores draws + winners. Usually already set by the Vercel↔Neon integration. |
| `CRON_SECRET` | Shared secret Vercel Cron sends as a bearer token; the draw/payout routes reject anything else. Generate with `openssl rand -hex 32`. |
| `PRIZE_WALLET_PK` | Private key of the hot wallet that pays the prize. **Fund this wallet** with the prize token (+ a little fee-currency for gas). |
| `PRIZE_TOKEN_ADDRESS` / `PRIZE_TOKEN_DECIMALS` | **Mainnet only** — point the prize at COPm (`0x8A567e2aE79CA692Bd748aB832081C45de4041eA`, 18 decimals). Defaults: Anvil mock / Sepolia USDC stand-in. |

Fail-safe by design: without `CRON_SECRET`, or on any day the prize wallet can't cover
the pot, the raffle simply doesn't draw or pay (no errors). The `raffle_draws` /
`raffle_entries` tables auto-create on first use. Set the daily prize amount via
`RAFFLE_BASE_PRIZE_COPM` in [`web/lib/raffle.ts`](web/lib/raffle.ts).

---

## License

MIT
