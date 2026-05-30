insert into storage.buckets (id, name, public)
values ('property-media', 'property-media', true)
on conflict (id) do update set public = excluded.public;

create policy "public read property media"
on storage.objects for select
using (bucket_id = 'property-media');

create policy "organization members upload property media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'property-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
);

create policy "organization members update property media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'property-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
)
with check (
  bucket_id = 'property-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
);

create policy "organization members delete property media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'property-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
);
