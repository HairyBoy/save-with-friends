// Neon (Postgres) access for the off-chain, synced data: the friends list and
// vault names/emojis. Server-only — these helpers run inside route handlers, never
// the browser. The connection string is DATABASE_URL (set by the Vercel↔Neon
// integration in prod, and in web/.env.local for dev).
//
// The two tables hold COSMETIC/social data only — nicknames and vault display
// names. No funds, no on-chain authority. Requests are scoped by the caller's
// wallet address (which rides in on MiniPay's own auth); vault-name writes are
// additionally checked against on-chain ownership. See the route handlers.

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;
let _schemaReady: Promise<void> | null = null;

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getSql(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  if (!_sql) _sql = neon(url);
  return _sql;
}

/** Idempotent schema bootstrap — runs once per server instance. */
export function ensureSchema(): Promise<void> {
  if (!_schemaReady) {
    const sql = getSql();
    _schemaReady = (async () => {
      await sql`create table if not exists friends (
        owner_address  text not null,
        friend_address text not null,
        nickname       text not null,
        created_at     timestamptz not null default now(),
        primary key (owner_address, friend_address)
      )`;
      await sql`create index if not exists friends_owner_idx on friends (owner_address)`;
      await sql`create table if not exists vault_meta (
        chain_id      integer not null,
        vault_id      text not null,
        owner_address text not null,
        name          text not null,
        icon          text not null,
        created_at    text,
        updated_at    timestamptz not null default now(),
        primary key (chain_id, vault_id)
      )`;
    })().catch((e) => {
      _schemaReady = null; // let a later request retry the bootstrap
      throw e;
    });
  }
  return _schemaReady;
}
