insert into storage.buckets (id, name, public)
values ('attendance-media', 'attendance-media', false)
on conflict (id) do update set public = excluded.public;

create policy "organization members read attendance media"
on storage.objects for select
to authenticated
using (
  bucket_id = 'attendance-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
);

create policy "organization members upload attendance media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'attendance-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "organization members update own attendance media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'attendance-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'attendance-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "organization members delete own attendance media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'attendance-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);
