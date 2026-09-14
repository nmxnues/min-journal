-- HTF pairing is trimmed from four options to two: M -> W -> D and W -> D.
-- The "2D" step in both original options is dropped in favor of a plain "D",
-- and the D -> H1 / H1 -> M5 options (never actually used — confirmed via a
-- direct query: live data was 100% m_w_2d/w_2d) are removed outright.
--
-- Existing rows are remapped rather than left stale:
--   m_w_2d -> m_w_d
--   w_2d   -> w_d
--
-- CHECK constraints (not a Postgres enum) are exactly why this is a plain
-- data update + two-line constraint swap — see docs/decisions.md § Phase 1.

alter table public.trades drop constraint trades_htf_pairing_check;

update public.trades set htf_pairing = 'm_w_d' where htf_pairing = 'm_w_2d';
update public.trades set htf_pairing = 'w_d' where htf_pairing = 'w_2d';

alter table public.trades
  add constraint trades_htf_pairing_check check (htf_pairing in ('m_w_d', 'w_d'));

alter table public.trades alter column htf_pairing set default 'w_d';
