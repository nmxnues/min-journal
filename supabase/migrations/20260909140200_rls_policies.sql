-- RLS — single rule per table, per docs/build-prompt.md §3:
-- "auth.uid() = user_id" and nothing else. One `for all` policy per table
-- covers select/insert/update/delete uniformly.

alter table public.accounts enable row level security;
alter table public.models enable row level security;
alter table public.trades enable row level security;
alter table public.attachments enable row level security;
alter table public.cash_movements enable row level security;
alter table public.weekly_reviews enable row level security;
alter table public.drafts enable row level security;
alter table public.settings enable row level security;

create policy "owner_only" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner_only" on public.models
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner_only" on public.trades
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner_only" on public.attachments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner_only" on public.cash_movements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner_only" on public.weekly_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner_only" on public.drafts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner_only" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
