-- Harden Custom Launch after 0013. Isolated from Normal Launch `stories`.
-- Writes stay on the service role; clients only read through RLS.

alter table public.custom_launch_executions
  add constraint custom_launch_executions_completed_has_tx
  check (status not in ('completed', 'burned') or tx_hash is not null);

alter table public.custom_launch_splits
  add constraint custom_launch_splits_dest_check
  check (dest in (
    'orbitx', 'creator', 'holders', 'liquidity', 'buyback', 'burn',
    'charity', 'treasury', 'community', 'custom'
  ));

alter table public.custom_launch_splits
  add constraint custom_launch_splits_orbitx_locked
  check (dest <> 'orbitx' or bps = 2500);

alter table public.custom_launch_vaults
  add constraint custom_launch_vaults_dest_check
  check (dest in (
    'orbitx', 'creator', 'holders', 'liquidity', 'buyback', 'burn',
    'charity', 'treasury', 'community', 'custom'
  ));

create policy "author read own custom distributions" on public.custom_launch_distributions
  for select using (
    exists (
      select 1 from public.custom_launches l
      where l.id = launch_id and l.author_user_id = auth.uid()
    )
  );

revoke insert, update, delete, truncate on
  public.custom_launches,
  public.custom_launch_splits,
  public.custom_launch_vaults,
  public.custom_launch_markets,
  public.custom_launch_rules,
  public.custom_launch_milestones,
  public.custom_launch_executions,
  public.custom_launch_distributions
from anon, authenticated;

comment on constraint custom_launch_executions_completed_has_tx on public.custom_launch_executions is
  'completed/burned is confirmation-only and requires a chain tx hash.';
comment on constraint custom_launch_splits_orbitx_locked on public.custom_launch_splits is
  'OrbitX protocol share is locked at 2500 bps.';
