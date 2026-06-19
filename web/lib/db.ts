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
      // Self-chosen display name per wallet — the single source of identity. Every
      // place a person is shown (friends list, keyholder, invite) reads this; raw
      // addresses are never surfaced.
      await sql`create table if not exists users (
        address      text primary key,
        display_name text not null,
        updated_at   timestamptz not null default now()
      )`;
      // Invite links: a token carries the inviter (name resolved from users) and an
      // optional vault context (future per-vault join). Accepting writes a mutual
      // friendship.
      await sql`create table if not exists invites (
        token           text primary key,
        inviter_address text not null,
        vault_id        text,
        created_at      timestamptz not null default now(),
        expires_at      timestamptz
      )`;
      // Friendships are now pure edges; names come from users (no typed nicknames).
      await sql`alter table friends alter column nickname drop not null`;
      // Shared-vault DRAFTS: a group is assembled off-chain (owner + members who joined
      // via the draft link) before the owner launches it on-chain with a fixed roster.
      // `launched_vault_id` is the on-chain id once created (null = still a draft).
      await sql`create table if not exists vault_drafts (
        id                 text primary key,
        owner_address      text not null,
        name               text not null,
        icon               text not null,
        goal               text not null,
        deadline_days      integer not null,
        payout             integer not null,
        launched_vault_id  text,
        created_at         timestamptz not null default now()
      )`;
      await sql`create table if not exists draft_members (
        draft_id       text not null,
        member_address text not null,
        created_at     timestamptz not null default now(),
        primary key (draft_id, member_address)
      )`;
      // Raffle draws + their entry snapshots. Entries are DERIVED from on-chain
      // Deposited events at draw time (the chain is the source of truth); we
      // snapshot them here for a fast UI and an audit trail. `status`:
      //   'drawn'  — winner picked, COPm not yet sent
      //   'paid'   — COPm transferred (payout_tx_hash set)
      //   'skipped'— nobody qualified; prize_copm rolls into a later draw
      // P1 only READS these (winners history + rollover); the draw job (P2) writes.
      await sql`create table if not exists raffle_draws (
        id             bigserial primary key,
        chain_id       integer not null,
        window_start   timestamptz not null,
        draw_at        timestamptz not null,
        prize_copm     numeric not null,
        status         text not null,
        winner_address text,
        total_weight   numeric,
        random_seed    text,
        payout_tx_hash text,
        created_at     timestamptz not null default now()
      )`;
      await sql`create unique index if not exists raffle_draws_chain_draw_idx
        on raffle_draws (chain_id, draw_at)`;
      await sql`create table if not exists raffle_entries (
        draw_id       bigint not null references raffle_draws(id) on delete cascade,
        address       text not null,
        weight_usd    numeric not null,
        deposit_count integer not null,
        primary key (draw_id, address)
      )`;
    })().catch((e) => {
      _schemaReady = null; // let a later request retry the bootstrap
      throw e;
    });
  }
  return _schemaReady;
}
