-- Min Journal — initial schema.
-- Source of truth: docs/README.md (screens, entities) + docs/build-prompt.md §4
-- (schema skeleton) + docs/decisions.md (fields the spec left open, resolved
-- by the user). Derived values (plannedR, realizedR, offPlan, rangeSize,
-- pnlAmount, balance/1R series, ledger) are NOT stored — computed in
-- src/lib/domain/*. The one frozen exception is trades.r_value_at_entry.

-- ---------------------------------------------------------------------------
-- updated_at helper, reused by every table that has the column
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  currency text not null default 'USD',
  starting_capital numeric not null check (starting_capital >= 0),
  started_at date not null,
  risk_mode text not null check (risk_mode in ('percent', 'fixed')),
  risk_percent numeric check (risk_percent > 0),
  fixed_risk_amount numeric check (fixed_risk_amount > 0),
  drawdown_limit_percent numeric not null default 10 check (drawdown_limit_percent > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint risk_mode_fields_match check (
    (risk_mode = 'percent' and risk_percent is not null and fixed_risk_amount is null)
    or
    (risk_mode = 'fixed' and fixed_risk_amount is not null and risk_percent is null)
  )
);

create index accounts_user_id_idx on public.accounts (user_id);

create trigger set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- models (Playbook)
-- ---------------------------------------------------------------------------
create table public.models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  rules jsonb not null default '[]'::jsonb, -- ordered array of strings
  status text not null default 'active' check (status in ('active', 'retired')),
  sort_order integer not null default 0,
  reference_image_path text, -- storage path in the chart-shots bucket
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index models_user_id_status_sort_idx on public.models (user_id, status, sort_order);

create trigger set_updated_at
  before update on public.models
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- trades
-- ---------------------------------------------------------------------------
create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete restrict,
  date date not null,
  instrument text not null,
  direction text not null check (direction in ('long', 'short')),
  session text not null check (session in ('asia', 'london', 'ny_am', 'ny_pm')),
  -- docs/decisions.md: fixed 4-option set, stored as codes; display strings
  -- ("M → W → 2D" etc.) are resolved in the UI layer.
  htf_pairing text not null default 'w_2d'
    check (htf_pairing in ('m_w_2d', 'w_2d', 'd_h1', 'h1_m5')),
  range_high numeric not null,
  range_low numeric not null,
  sweep_side text not null check (sweep_side in ('low', 'high', 'both', 'none')),
  entry numeric not null,
  stop numeric not null,
  target numeric,
  exit numeric,
  size numeric not null check (size > 0),
  model_id uuid references public.models (id) on delete set null,
  -- docs/decisions.md: free text, not a select — option set isn't settled yet.
  confirmation text,
  result text check (result in ('win', 'loss', 'be')),
  exit_reason text,
  hold_minutes integer check (hold_minutes >= 0),
  -- Frozen at log time from the account's 1R at that date. Never rewritten by
  -- later risk-setting or cash-movement changes (see docs/README.md § Capital).
  r_value_at_entry numeric not null check (r_value_at_entry > 0),
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint range_high_above_low check (range_high > range_low),
  constraint stop_not_entry check (stop <> entry)
);

create index trades_user_id_date_idx on public.trades (user_id, date desc);
create index trades_user_id_account_id_idx on public.trades (user_id, account_id);
create index trades_user_id_model_id_idx on public.trades (user_id, model_id);

create trigger set_updated_at
  before update on public.trades
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- attachments (chart screenshots — files live in Storage bucket chart-shots)
-- ---------------------------------------------------------------------------
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trade_id uuid not null references public.trades (id) on delete cascade,
  storage_path text not null,
  width integer,
  height integer,
  caption text,
  created_at timestamptz not null default now()
);

create index attachments_trade_id_idx on public.attachments (trade_id);

-- ---------------------------------------------------------------------------
-- cash_movements
-- ---------------------------------------------------------------------------
create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete restrict,
  date date not null,
  type text not null check (type in ('deposit', 'withdrawal')),
  amount numeric not null check (amount > 0),
  currency text not null,
  note text,
  created_at timestamptz not null default now()
);

create index cash_movements_user_account_date_idx on public.cash_movements (user_id, account_id, date);

-- ---------------------------------------------------------------------------
-- weekly_reviews
-- ---------------------------------------------------------------------------
create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  iso_week text not null, -- e.g. '2026-W37'
  what_worked text,
  what_didnt text,
  one_change text,
  focus_items jsonb not null default '[]'::jsonb, -- [{ text, checked }]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, iso_week)
);

create trigger set_updated_at
  before update on public.weekly_reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- drafts (single in-progress trade per user)
-- ---------------------------------------------------------------------------
create table public.drafts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.drafts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- settings (one row per user, seeded by the auth trigger — see
-- 20260909140300_auth_provisioning.sql)
-- ---------------------------------------------------------------------------
create table public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  locale text not null default 'ko' check (locale in ('ko', 'en')),
  pnl_convention text not null default 'kr' check (pnl_convention in ('kr', 'west')),
  default_instrument text not null default 'EURUSD',
  default_session text not null default 'asia' check (default_session in ('asia', 'london', 'ny_am', 'ny_pm')),
  r_precision integer not null default 1 check (r_precision between 0 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();
