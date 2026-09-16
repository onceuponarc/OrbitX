-- OrbitX revenue fees (0.20% trading fee, $0.25 launch fee).
--
-- Deliberately a SEPARATE table from public.fee_events. fee_events records the
-- creator-fee waterfall (author_amount / vault_amount / protocol_amount) and is
-- not touched by the OrbitX revenue system; mixing the two would conflate
-- creator earnings with platform revenue.

create table public.orbitx_revenue_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('trade', 'launch')),
  -- One row per fee-bearing transaction. Unique so a retry or a double webhook
  -- cannot inflate reported revenue.
  signature text not null unique,
  user_id uuid references auth.users (id) on delete set null,
  payer text not null,
  fee_mint text not null,
  -- Raw base units of fee_mint, never a float.
  fee_amount_raw numeric not null check (fee_amount_raw >= 0),
  fee_bps integer,
  fee_usd numeric,
  side text check (side in ('buy', 'sell')),
  token_mint text,
  -- True only when the transfer was read back off the confirmed transaction's
  -- balance deltas. Intent alone never sets this.
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index on public.orbitx_revenue_events (created_at desc);
create index on public.orbitx_revenue_events (kind, created_at desc);

alter table public.orbitx_revenue_events enable row level security;

-- No policies, by design: platform revenue is service-role only. This differs
-- from fee_events, which carries a public read policy because creator fees are
-- shown on story pages.
