-- Account kind (live | backtest) and multi-account support (docs/decisions.md
-- § Phase 9 backtest follow-up). README always reserved `accountId`
-- everywhere for multi-account but left the UI undesigned; this is the first
-- real slice of it, driven by the need to keep a live account's frozen
-- r_value_at_entry rule completely untouched while giving a backtest account
-- a different (date-based) rule.

alter table public.accounts
  add column kind text not null default 'live' check (kind in ('live', 'backtest'));

comment on column public.accounts.kind is
  'live: r_value_at_entry freezes the balance as of "now" when a trade is '
  'logged (unchanged behavior). backtest: r_value_at_entry freezes the '
  'balance as of the trade''s own date, over whatever is already stored for '
  'the account — the only way to enter a full year of one instrument, then '
  'a full year of another, into the same simulated account without later '
  'trades inflating earlier ones'' 1R.';
