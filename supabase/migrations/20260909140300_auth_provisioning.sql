-- docs/decisions.md: no sign-up flow exists to attach a settings row to, so
-- one is seeded automatically when the (manually created, single) user
-- appears in auth.users. Accounts are deliberately NOT seeded here — starting
-- capital / currency / risk mode need real input, via onboarding UI (Phase 8).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
