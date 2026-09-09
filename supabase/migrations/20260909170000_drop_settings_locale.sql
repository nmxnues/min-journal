-- Language is decided by viewport width, not a user setting (docs/decisions.md
-- § Phase 3 follow-up: >=900px English, <900px Korean, same rule the
-- responsive layout breakpoint already uses). A manual override was proposed
-- there but rejected by the user — no override, so no column: an unused
-- setting left in the schema just invites confusion later about why it
-- exists. handle_new_user's `insert into public.settings (user_id) ...`
-- relies only on column defaults and needs no change.
alter table public.settings drop column locale;
