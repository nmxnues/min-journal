-- Commission on a trade (Raw-spread accounts charge per lot on both the
-- entry and the exit).
--
-- Like `swap`, these are inputs the broker decides, not derived values
-- (docs/build-prompt.md §4). They land on the money axis only — balance,
-- ledger, TWR, drawdown and the currency P&L — and never on the R axis
-- (docs/decisions.md § Commission):
--
--     pnlAmount = realizedR * rValueAtEntry + swap - entry_commission - exit_commission
--
-- Unlike `swap` they are NOT NULL DEFAULT 0: the user asked for existing
-- trades to read as zero commission. ADD COLUMN with a constant default is a
-- metadata-only change in Postgres 11+, so no existing row is rewritten and
-- the set_updated_at trigger never fires.
alter table public.trades
  add column entry_commission numeric not null default 0 check (entry_commission >= 0),
  add column exit_commission numeric not null default 0 check (exit_commission >= 0);

comment on column public.trades.entry_commission is
  'Commission charged on the entry, in the account currency (accounts.currency). '
  'Stored positive and subtracted as a cost. Never feeds realizedR or any '
  'R-based statistic — see docs/decisions.md § Commission.';
comment on column public.trades.exit_commission is
  'Commission charged on the exit, in the account currency (accounts.currency). '
  'Stored positive and subtracted as a cost. Never feeds realizedR or any '
  'R-based statistic — see docs/decisions.md § Commission.';

-- One-way commission per 1.0 lot. The trade forms prefill both commissions
-- with size * this value; the trader can still overwrite either one.
alter table public.settings
  add column commission_per_lot_per_side numeric not null default 0
    check (commission_per_lot_per_side >= 0);

comment on column public.settings.commission_per_lot_per_side is
  'One-way (per side) commission per 1.0 lot, in the account currency. '
  'Only a form default: the stored trades.entry_commission / exit_commission '
  'are what every calculation reads.';
