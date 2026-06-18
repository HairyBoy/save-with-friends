// Resolve a phone number to a wallet address via ODIS (server-side; see lib/odis.ts).
// OFF unless ODIS_QUERY_PK is configured — the rest of the app (address-based add)
// works regardless. Returns { address } (null if no attestation for that number).
import { isOdisConfigured, resolvePhone } from "@/lib/odis";

// contractkit/web3 need the Node runtime (not edge).
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isOdisConfigured()) {
    return Response.json({ error: "phone resolution not configured" }, { status: 503 });
  }
  const { phone } = (await req.json()) as { phone?: string };
  if (!phone || typeof phone !== "string") {
    return Response.json({ error: "phone (E.164) required" }, { status: 400 });
  }
  try {
    const address = await resolvePhone(phone.trim());
    return Response.json({ address }); // address is null if nobody is attested for it
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "resolution failed" },
      { status: 400 },
    );
  }
}
