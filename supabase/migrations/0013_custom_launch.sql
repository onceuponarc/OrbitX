-- Custom Launch on-chain state. Isolated from Normal Launch `stories` rows.
-- Blockchain confirmation is the source of truth for executions.

create table if not exists public.custom_launches (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null references public.users(id),
  chain text not null check (chain in ('solana', 'arc', 'robinhood')),
  slug citext unique not null,
  status text not null default 'draft'
    check (status in ('draft', 'preparing', 'deploying', 'live', 'failed', 'paused')),
  config jsonb not null default '{}'::jsonb,
  token_name text not null,
  token_symbol text not null,
  decimals int not null default 9,
  supply numeric(78,0) not null,
  trade_fee_bps int not null check (trade_fee_bps >= 0 and trade_fee_bps <= 500),
  token_address text,
  pool_address text,
  router_address text,
  hub_address text,
  factory_address text,
  metadata_uri text,
  quote_address text,
  creator_address text,
  charity_address text,
  treasury_address text,
  community_address text,
  deploy_tx text,
  deploy_error text,
  deployed_at timestamptz,
  paused boolean not null default false,
  story_id uuid references public.stories(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.custom_launch_splits (
  launch_id uuid not null references public.custom_launches(id) on delete cascade,
  dest text not null,
  bps int not null check (bps >= 0 and bps <= 10000),
  destination_address text,
  primary key (launch_id, dest)
);

create table if not exists public.custom_launch_vaults (
  launch_id uuid not null references public.custom_launches(id) on delete cascade,
  dest text not null,
  chain_address text,
  quote_balance numeric(78,0) not null default 0,
  token_balance numeric(78,0) not null default 0,
  synced_at timestamptz,
  primary key (launch_id, dest)
);

create table if not exists public.custom_launch_markets (
  id uuid primary key default gen_random_uuid(),
  launch_id uuid not null references public.custom_launches(id) on delete cascade,
  role text not null check (role in ('primary', 'secondary')),
  quote_symbol text not null,
  pool_address text,
  token_liquidity numeric(78,0),
  quote_liquidity numeric(78,0),
  status text not null default 'pending'
    check (status in ('pending', 'live', 'unsupported', 'failed'))
);

create table if not exists public.custom_launch_rules (
  id uuid primary key default gen_random_uuid(),
  launch_id uuid not null references public.custom_launches(id) on delete cascade,
  name text not null,
  status text not null default 'draft',
  trigger text not null,
  action text not null,
  config jsonb not null default '{}'::jsonb,
  threshold numeric(38,8),
  cooldown_seconds int not null default 0,
  max_execution numeric(78,0),
  last_executed_at timestamptz,
  execution_count int not null default 0,
  constraint custom_launch_rules_no_remove_liq check (action <> 'remove_liquidity')
);

create table if not exists public.custom_launch_milestones (
  id uuid primary key default gen_random_uuid(),
  launch_id uuid not null references public.custom_launches(id) on delete cascade,
  market_cap numeric(38,8) not null,
  action text not null,
  constraint custom_launch_milestones_no_remove_liq check (action <> 'remove_liquidity')
);

create table if not exists public.custom_launch_executions (
  id uuid primary key default gen_random_uuid(),
  launch_id uuid not null references public.custom_launches(id) on delete cascade,
  rule_id uuid references public.custom_launch_rules(id),
  action text not null,
  exec_id text not null,
  status text not null default 'pending'
    check (status in (
      'pending','claiming','claimed','swapping','swapped','burning','burned',
      'completed','failed','recovered'
    )),
  amount numeric(78,0),
  received numeric(78,0),
  tx_hash text,
  explorer_url text,
  error text,
  public_event boolean not null default true,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (launch_id, exec_id),
  constraint custom_launch_executions_no_remove_liq check (action <> 'remove_liquidity')
);

create table if not exists public.custom_launch_distributions (
  id uuid primary key default gen_random_uuid(),
  launch_id uuid not null references public.custom_launches(id) on delete cascade,
  execution_id uuid references public.custom_launch_executions(id),
  recipient text not null,
  amount numeric(78,0) not null,
  tx_hash text
);

create index if not exists custom_launches_author_idx on public.custom_launches (author_user_id, created_at desc);
create index if not exists custom_launches_chain_status_idx on public.custom_launches (chain, status, created_at desc);
create index if not exists custom_launch_executions_launch_idx on public.custom_launch_executions (launch_id, created_at desc);

alter table public.custom_launches enable row level security;
alter table public.custom_launch_splits enable row level security;
alter table public.custom_launch_vaults enable row level security;
alter table public.custom_launch_markets enable row level security;
alter table public.custom_launch_rules enable row level security;
alter table public.custom_launch_milestones enable row level security;
alter table public.custom_launch_executions enable row level security;
alter table public.custom_launch_distributions enable row level security;

create policy "public read live custom launches" on public.custom_launches
  for select using (status in ('live', 'paused'));

create policy "author read own custom launches" on public.custom_launches
  for select using (author_user_id = auth.uid());

create policy "public read custom splits" on public.custom_launch_splits
  for select using (
    exists (select 1 from public.custom_launches l where l.id = launch_id and l.status in ('live', 'paused'))
  );

create policy "public read custom vaults" on public.custom_launch_vaults
  for select using (
    exists (select 1 from public.custom_launches l where l.id = launch_id and l.status in ('live', 'paused'))
  );

create policy "public read custom markets" on public.custom_launch_markets
  for select using (
    exists (select 1 from public.custom_launches l where l.id = launch_id and l.status in ('live', 'paused'))
  );

create policy "public read confirmed custom executions" on public.custom_launch_executions
  for select using (
    public_event = true
    and status in ('completed', 'burned')
    and tx_hash is not null
  );

create policy "author read own custom executions" on public.custom_launch_executions
  for select using (
    exists (select 1 from public.custom_launches l where l.id = launch_id and l.author_user_id = auth.uid())
  );

create policy "author read own custom splits" on public.custom_launch_splits
  for select using (
    exists (select 1 from public.custom_launches l where l.id = launch_id and l.author_user_id = auth.uid())
  );

create policy "author read own custom vaults" on public.custom_launch_vaults
  for select using (
    exists (select 1 from public.custom_launches l where l.id = launch_id and l.author_user_id = auth.uid())
  );

create policy "author read own custom markets" on public.custom_launch_markets
  for select using (
    exists (select 1 from public.custom_launches l where l.id = launch_id and l.author_user_id = auth.uid())
  );

create policy "author read own custom rules" on public.custom_launch_rules
  for select using (
    exists (select 1 from public.custom_launches l where l.id = launch_id and l.author_user_id = auth.uid())
  );

create policy "author read own custom milestones" on public.custom_launch_milestones
  for select using (
    exists (select 1 from public.custom_launches l where l.id = launch_id and l.author_user_id = auth.uid())
  );

create policy "public read custom distributions" on public.custom_launch_distributions
  for select using (
    exists (
      select 1 from public.custom_launch_executions e
      where e.id = execution_id and e.public_event and e.status in ('completed', 'burned')
    )
  );

comment on table public.custom_launches is
  'Custom Launch deployments. Normal Launch continues to use public.stories without these rows.';
comment on table public.custom_launch_executions is
  'status=completed only after a confirmed chain transaction. Intent never sets completed.';
