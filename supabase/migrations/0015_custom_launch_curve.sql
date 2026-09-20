-- Custom Launch bonding curve + linked real DEX books.
-- Isolated from Normal Launch `stories` / `bindings` / `curve_secrets`.
-- Neither OrbitX nor the creator deposits quote LP at print.

alter table public.custom_launches
  add column if not exists mint_program text,
  add column if not exists vault_address text,
  add column if not exists virtual_quote_raw numeric(78,0),
  add column if not exists virtual_base_raw numeric(78,0),
  add column if not exists real_quote_raw numeric(78,0) not null default 0,
  add column if not exists real_base_raw numeric(78,0),
  add column if not exists curve_k numeric(78,0),
  add column if not exists graduation_quote_raw numeric(78,0),
  add column if not exists lp_base_reserved_raw numeric(78,0),
  add column if not exists curve_status text not null default 'none';

alter table public.custom_launches drop constraint if exists custom_launches_status_check;
alter table public.custom_launches
  add constraint custom_launches_status_check
  check (status in ('draft', 'preparing', 'deploying', 'live', 'failed', 'paused', 'graduated'));

alter table public.custom_launches drop constraint if exists custom_launches_curve_status_check;
alter table public.custom_launches
  add constraint custom_launches_curve_status_check
  check (curve_status in ('none', 'curve', 'graduated'));

alter table public.custom_launches drop constraint if exists custom_launches_mint_program_check;
alter table public.custom_launches
  add constraint custom_launches_mint_program_check
  check (mint_program is null or mint_program in ('spl', 'token2022', 'erc20'));

alter table public.custom_launch_markets
  add column if not exists dex text,
  add column if not exists label text,
  add column if not exists url text,
  add column if not exists kind text not null default 'recorded';

alter table public.custom_launch_markets drop constraint if exists custom_launch_markets_status_check;
alter table public.custom_launch_markets
  add constraint custom_launch_markets_status_check
  check (status in ('pending', 'live', 'unsupported', 'failed', 'curve', 'linked'));

alter table public.custom_launch_markets drop constraint if exists custom_launch_markets_kind_check;
alter table public.custom_launch_markets
  add constraint custom_launch_markets_kind_check
  check (kind in ('curve', 'canonical', 'graduated', 'recorded'));

alter table public.custom_launch_vaults drop constraint if exists custom_launch_vaults_dest_check;
alter table public.custom_launch_vaults
  add constraint custom_launch_vaults_dest_check
  check (dest in (
    'orbitx', 'creator', 'holders', 'liquidity', 'buyback', 'burn',
    'charity', 'treasury', 'community', 'custom', 'curve'
  ));

drop policy if exists "public read live custom launches" on public.custom_launches;
create policy "public read live custom launches" on public.custom_launches
  for select using (status in ('live', 'paused', 'graduated'));

drop policy if exists "public read custom splits" on public.custom_launch_splits;
create policy "public read custom splits" on public.custom_launch_splits
  for select using (
    exists (select 1 from public.custom_launches l where l.id = launch_id and l.status in ('live', 'paused', 'graduated'))
  );

drop policy if exists "public read custom vaults" on public.custom_launch_vaults;
create policy "public read custom vaults" on public.custom_launch_vaults
  for select using (
    exists (select 1 from public.custom_launches l where l.id = launch_id and l.status in ('live', 'paused', 'graduated'))
  );

drop policy if exists "public read custom markets" on public.custom_launch_markets;
create policy "public read custom markets" on public.custom_launch_markets
  for select using (
    exists (select 1 from public.custom_launches l where l.id = launch_id and l.status in ('live', 'paused', 'graduated'))
  );

comment on column public.custom_launches.curve_status is
  'curve = buyer-funded bonding curve at print (real_quote_raw starts at 0). graduated = vault swept into a real DEX pool. none = no curve.';
comment on column public.custom_launches.real_quote_raw is
  'Quote deposited by buyers into the curve vault. Never seeded by OrbitX or the creator.';
comment on table public.custom_launch_markets is
  'Primary curve book plus auto-linked canonical funded DEX pools. Does not write stories/bindings.';
