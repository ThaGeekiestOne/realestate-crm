insert into storage.buckets (id, name, public)
values ('property-documents', 'property-documents', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "organization members access property documents" on property_documents;

create policy "organization members view property documents"
on property_documents for select
using (organization_id = current_organization_id());

create policy "inventory managers create property documents"
on property_documents for insert
with check (
  organization_id = current_organization_id()
  and current_profile_role() in ('admin', 'sales_manager')
);

create policy "inventory managers update property documents"
on property_documents for update
using (
  organization_id = current_organization_id()
  and current_profile_role() in ('admin', 'sales_manager')
)
with check (
  organization_id = current_organization_id()
  and current_profile_role() in ('admin', 'sales_manager')
);

create policy "inventory managers delete property documents"
on property_documents for delete
using (
  organization_id = current_organization_id()
  and current_profile_role() in ('admin', 'sales_manager')
);

create policy "public read property documents"
on storage.objects for select
using (bucket_id = 'property-documents');

create policy "inventory managers upload property documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'property-documents'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and current_profile_role() in ('admin', 'sales_manager')
);

create policy "inventory managers update property documents"
on storage.objects for update
to authenticated
using (
  bucket_id = 'property-documents'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and current_profile_role() in ('admin', 'sales_manager')
)
with check (
  bucket_id = 'property-documents'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and current_profile_role() in ('admin', 'sales_manager')
);

create policy "inventory managers delete property documents"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'property-documents'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and current_profile_role() in ('admin', 'sales_manager')
);
