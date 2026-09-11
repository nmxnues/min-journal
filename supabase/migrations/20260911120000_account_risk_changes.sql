-- Risk-setting history (docs/decisions.md § Phase 8).
--
-- accounts.risk_* holds the setting in force *today* — what the next logged
-- trade freezes into trades.r_value_at_entry. This table records every value
-- that setting has ever had, so the Capital screen's 1R line and "1R history"
-- can show what 1R was actually worth at each point instead of re-projecting
-- the whole past under today's setting.
--
-- It is input history, not a derived value: the balance series, 1R series and
-- ledger are still computed in src/lib/domain/capital.ts and never stored.
-- Nothing here touches trades.r_value_at_entry.
--
-- Rows are written only by the triggers below, so the history can't drift
-- from the accounts row: one row when an account is created (effective from
-- its started_at), one more each time the setting actually changes
-- (effective from the moment of the change).

create table public.account_risk_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  effective_at timestamptz not null default now(),
  risk_mode text not null check (risk_mode in ('percent', 'fixed')),
  risk_percent numeric check (risk_percent > 0),
  fixed_risk_amount numeric check (fixed_risk_amount > 0),
  created_at timestamptz not null default now(),
  constraint risk_mode_fields_match check (
    (risk_mode = 'percent' and risk_percent is not null and fixed_risk_amount is null)
    or
    (risk_mode = 'fixed' and fixed_risk_amount is not null and risk_percent is null)
  )
);

create index account_risk_changes_account_effective_idx
  on public.account_risk_changes (account_id, effective_at);

alter table public.account_risk_changes enable row level security;

create policy "owner_only" on public.account_risk_changes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Triggers: the only writers of this table
-- ---------------------------------------------------------------------------
create or replace function public.record_account_risk_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.account_risk_changes (
    user_id, account_id, effective_at, risk_mode, risk_percent, fixed_risk_amount
  ) values (
    new.user_id,
    new.id,
    case when tg_op = 'INSERT' then new.started_at::timestamptz else now() end,
    new.risk_mode,
    new.risk_percent,
    new.fixed_risk_amount
  );
  return new;
end;
$$;

create trigger record_risk_change_on_insert
  after insert on public.accounts
  for each row execute function public.record_account_risk_change();

create trigger record_risk_change_on_update
  after update of risk_mode, risk_percent, fixed_risk_amount on public.accounts
  for each row
  when (
    old.risk_mode is distinct from new.risk_mode
    or old.risk_percent is distinct from new.risk_percent
    or old.fixed_risk_amount is distinct from new.fixed_risk_amount
  )
  execute function public.record_account_risk_change();

-- ---------------------------------------------------------------------------
-- Backfill: accounts created before this migration
-- ---------------------------------------------------------------------------
-- Until Phase 8 there was no UI that could change an account's risk setting
-- after creation, so its current value is the value it has always had.
insert into public.account_risk_changes (
  user_id, account_id, effective_at, risk_mode, risk_percent, fixed_risk_amount
)
select a.user_id, a.id, a.started_at::timestamptz, a.risk_mode, a.risk_percent, a.fixed_risk_amount
from public.accounts a
where not exists (
  select 1 from public.account_risk_changes r where r.account_id = a.id
);
