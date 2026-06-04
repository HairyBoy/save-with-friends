[English](README.md) · **Español**

# Save with Friends · _Ahorra con Amigos_

Una **Mini App de MiniPay** de ahorro social en [Celo](https://celo.org), creada para el
**Hackathon de Agentes Onchain Colombia**.

> 🚧 En etapa temprana de desarrollo — este README es una visión general de lo que
> estamos construyendo. Los detalles se irán completando a medida que el proyecto tome
> forma.

---

## La idea

Ahorrar dinero solo es difícil. **Ahorra con Amigos** lo hace social y te mantiene
firme: defines una meta, bloqueas tus stablecoins, y tus ahorros quedan bloqueados hasta
que realmente la alcances — con amigos acompañándote para ayudarte a seguir en el camino.

El giro: mientras tu dinero está bloqueado, no se queda inactivo. Estamos explorando
cómo un **agente de IA onchain** puede poner esos ahorros a trabajar por ti en segundo
plano, para que esperar a alcanzar tu meta te dé algo a cambio en el camino.

Lo estamos construyendo sobre **Celo** con **MiniPay**, usando stablecoins — incluyendo
**COPm** (el peso colombiano en Celo) — para que sea práctico para el ahorro del día a día.

---

## Por qué lo construimos

Esta es nuestra propuesta para el **Hackathon de Agentes Onchain Colombia** — un
hackathon enfocado en agentes de IA onchain y stablecoins. Queríamos algo genuinamente
útil para la gente común, pensado primero para móvil vía MiniPay, y una verdadera
muestra de lo que un agente onchain puede hacer con el dinero.

---

## Stack

- **Frontend** — Next.js 16 + Tailwind, [viem](https://viem.sh). En [`web/`](web/).
- **Cadena** — Celo (mainnet `42220` / testnet Sepolia `11142220`).
- **Billetera** — MiniPay (conexión sin clics vía `window.ethereum`).
- **Moneda** — stablecoins, con soporte de primera clase para **COPm** (peso colombiano en Celo).

---

## Cómo empezar

```bash
cd web
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Para probar dentro de MiniPay en un
dispositivo real, expón el servidor de desarrollo con un túnel (por ejemplo, ngrok) y
abre la URL en el probador de sitios de MiniPay.

---

## Licencia

MIT
