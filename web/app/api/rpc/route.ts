// Server-side JSON-RPC proxy to the dedicated Celo Sepolia RPC (e.g. Alchemy).
//
// The browser POSTs JSON-RPC to this same-origin route, and we forward it upstream
// using CELO_SEPOLIA_RPC — a SERVER-ONLY env var (no NEXT_PUBLIC_ prefix) — so the
// private RPC key is never bundled into the client. POST route handlers aren't
// cached, which is what we want for live RPC.
//
// Note: this is an open relay for the configured RPC. Fine for testnet/dev; for
// production add an origin allowlist and/or rate limiting so it can't be abused.
const UPSTREAM = process.env.CELO_SEPOLIA_RPC;

export async function POST(request: Request) {
  if (!UPSTREAM) {
    return Response.json({ error: "CELO_SEPOLIA_RPC not configured" }, { status: 500 });
  }
  const body = await request.text();
  const res = await fetch(UPSTREAM, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}
