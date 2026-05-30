insert into storage.buckets (id, name, public)
values ('social-media', 'social-media', true)
on conflict (id) do update set public = excluded.public;

create policy "public social media reads"
on storage.objects for select
using (bucket_id = 'social-media');

create policy "organization members upload social media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'social-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "organization members update own social media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'social-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'social-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "organization members delete own social media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'social-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);
