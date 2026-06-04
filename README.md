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

## License

MIT
