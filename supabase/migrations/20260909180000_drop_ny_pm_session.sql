-- The New York PM session isn't traded, so it's dropped from the allowed set
-- rather than left as a dead option nobody picks. Done now, while both tables
-- are still empty, so no rows need remapping.
--
-- Two constraints carry the session list: trades.session and the seeded
-- default on settings.default_session. CHECK constraints (rather than a
-- Postgres enum) are exactly why this is a two-line migration — see
-- docs/decisions.md § Phase 1.

alter table public.trades drop constraint trades_session_check;
alter table public.trades
  add constraint trades_session_check check (session in ('asia', 'london', 'ny_am'));

alter table public.settings drop constraint settings_default_session_check;
alter table public.settings
  add constraint settings_default_session_check
  check (default_session in ('asia', 'london', 'ny_am'));
