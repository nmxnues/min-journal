-- chart-shots: private bucket for chart screenshot attachments.
-- Objects are keyed by path convention {user_id}/{trade_id}/{filename} so
-- storage.foldername(name)[1] can carry the RLS check — storage.objects has
-- no user_id column of its own to key policies on directly.

insert into storage.buckets (id, name, public)
values ('chart-shots', 'chart-shots', false)
on conflict (id) do nothing;

create policy "chart_shots_select_own"
  on storage.objects for select
  using (bucket_id = 'chart-shots' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "chart_shots_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'chart-shots' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "chart_shots_update_own"
  on storage.objects for update
  using (bucket_id = 'chart-shots' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "chart_shots_delete_own"
  on storage.objects for delete
  using (bucket_id = 'chart-shots' and auth.uid()::text = (storage.foldername(name))[1]);
