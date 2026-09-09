-- The manually-created user predates the handle_new_user trigger (created in
-- Supabase Auth before this migration existed), so it never got a settings
-- row. One-time, idempotent backfill for any auth.users row missing one —
-- safe to re-run, and covers this project's actual history rather than
-- leaving it as an untracked manual fix.
insert into public.settings (user_id)
select id from auth.users
where id not in (select user_id from public.settings)
on conflict (user_id) do nothing;
