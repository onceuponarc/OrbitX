-- Make OrbitX revenue events multi-chain (Solana + RH + Arc).
--
-- 0011 was written Solana-first: one fee-bearing transaction, identified by a
-- single signature, because on Solana the fee rides inside the swap. Arc cannot
-- do that -- the curve's buy/sell take no fee recipient and an EOA cannot bundle
-- an ERC-20 transfer with a contract call -- so an Arc trade produces TWO
-- hashes: the trade, then the fee transfer.
--
-- This migration generalizes the table for both shapes without losing the
-- guarantee that a retry cannot inflate reported revenue.

alter table public.orbitx_revenue_events
  add column chain text not null default 'solana'
    check (chain in ('solana', 'rh', 'arc'));

alter table public.orbitx_revenue_events
  add column protocol text
    check (protocol in ('pumpfun', 'par', 'rh'));

-- The trade itself. On Solana this equals `signature` (one atomic transaction).
-- On Arc it is the curve buy/sell hash, distinct from the fee transfer hash.
alter table public.orbitx_revenue_events
  add column trade_signature text;

-- Token/quote addresses are EVM hex on Arc and base58 on Solana; the existing
-- text columns hold both. Record which asset the fee was actually taken in.
alter table public.orbitx_revenue_events
  add column fee_asset_decimals integer;

-- Why a fee is still uncollected, when verified = false. Null on success.
alter table public.orbitx_revenue_events
  add column collection_error text;

-- Uniqueness becomes per-chain: a Solana signature and an EVM tx hash live in
-- the same column and must not be assumed to share a namespace.
alter table public.orbitx_revenue_events
  drop constraint if exists orbitx_revenue_events_signature_key;

-- Arc rows may exist with no fee transaction at all (a confirmed trade whose fee
-- transfer failed), so `signature` can no longer be required.
alter table public.orbitx_revenue_events
  alter column signature drop not null;

-- One fee row per (chain, trade). This is the real invariant: a retried fee
-- transfer against the same trade must not create a second revenue row.
create unique index orbitx_revenue_events_chain_trade_key
  on public.orbitx_revenue_events (chain, trade_signature)
  where trade_signature is not null;

create unique index orbitx_revenue_events_chain_fee_tx_key
  on public.orbitx_revenue_events (chain, signature)
  where signature is not null;

create index orbitx_revenue_events_chain_created_idx
  on public.orbitx_revenue_events (chain, created_at desc);

-- Unverified rows are the reconciliation queue: a confirmed trade whose fee has
-- not been proven to have landed.
create index orbitx_revenue_events_unverified_idx
  on public.orbitx_revenue_events (chain, created_at desc)
  where verified = false;

comment on column public.orbitx_revenue_events.chain is
  'solana | rh | arc. Arc fees are configuration-driven (src/lib/fees/chains.ts).';
comment on column public.orbitx_revenue_events.verified is
  'True only when the transfer was read back off a confirmed transaction. Intent never sets this.';
