-- Missed trades: setups the system called valid but the trader didn't take,
-- logged so "not entering is a cost too" can be counted (docs/decisions.md §
-- Missed trades).
--
-- A separate table on purpose, not a flag on `trades`: nothing that reads
-- `trades` — balance, ledger, drawdown, 1R, every R statistic, CSV export —
-- can pick one of these up by accident. There is no account_id and no
-- r_value_at_entry, because a missed trade never touched an account.
--
-- This migration only CREATEs; no existing table or row is altered.
--
-- Derived values (the hypothetical R, and commission in R) are not stored,
-- same rule as trades (docs/build-prompt.md §4). The one input kept is the
-- commission rate at log time, so a later change to Settings never rewrites
-- a missed trade's R — the same promise trades.entry_commission keeps.
create table public.missed_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  time time,
  session text check (session in ('asia', 'london', 'ny_am')),
  instrument text not null,
  direction text not null check (direction in ('long', 'short')),
  entry numeric,
  stop numeric,
  target numeric,
  setup_note text,
  miss_reason text not null
    check (miss_reason in ('fear', 'prior_loss', 'low_conviction', 'away', 'other')),
  miss_reason_note text,
  result text not null check (result in ('win', 'loss', 'be')),
  commission_per_lot_per_side numeric not null default 0
    check (commission_per_lot_per_side >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint missed_stop_not_entry check (stop is null or entry is null or stop <> entry)
);

create index missed_trades_user_id_date_idx on public.missed_trades (user_id, date desc);

create trigger set_updated_at
  before update on public.missed_trades
  for each row execute function public.set_updated_at();

alter table public.missed_trades enable row level security;

create policy "owner_only" on public.missed_trades
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
