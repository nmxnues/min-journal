-- Swap (overnight interest) on a trade.
--
-- Not a derived value (docs/build-prompt.md §4 forbids storing those): the
-- broker decides it and nothing in the row can compute it, so it is an input
-- like `exit` or `hold_minutes`.
--
-- It lands on the money axis only — balance, ledger, TWR, drawdown and the
-- currency P&L — and never on the R axis. `realized_r` stays
-- (exit - entry) / risk so that a setup held for a week still compares with
-- the same setup closed the same day (docs/decisions.md § Swap).
alter table public.trades add column swap numeric;

comment on column public.trades.swap is
  'Overnight swap/financing, in the account currency (accounts.currency). '
  'Negative = cost, positive = credit; added straight to the balance. '
  'NULL = not recorded, which is deliberately distinct from a recorded 0 '
  '(an intraday close). Existing rows are left NULL rather than backfilled '
  'to 0 so they can be filled in later. Never feeds realizedR or any '
  'R-based statistic — see docs/decisions.md § Swap.';
