create or replace function can_access_lead(target_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from leads
    where id = target_lead_id
      and organization_id = current_organization_id()
      and (
        current_profile_role() in ('admin', 'sales_manager')
        or (current_profile_role() = 'sales_agent' and assigned_agent_id = auth.uid())
      )
  )
$$;

drop policy if exists "organization members access calls" on calls;
drop policy if exists "organization members access messages" on messages;
drop policy if exists "organization members access activities" on activities;
drop policy if exists "organization members access property shares" on lead_property_shares;

revoke insert, update, delete on calls from authenticated;
revoke insert, update, delete on messages from authenticated;
revoke insert, update, delete on activities from authenticated;
revoke insert, update, delete on lead_property_shares from authenticated;

create policy "authorized members view calls"
on calls for select
using (
  organization_id = current_organization_id()
  and can_access_lead(lead_id)
);

create policy "authorized members view messages"
on messages for select
using (
  organization_id = current_organization_id()
  and can_access_lead(lead_id)
);

create policy "authorized members view activities"
on activities for select
using (
  organization_id = current_organization_id()
  and (
    current_profile_role() in ('admin', 'sales_manager')
    or actor_id = auth.uid()
    or (lead_id is not null and can_access_lead(lead_id))
  )
);

create policy "authorized members view property shares"
on lead_property_shares for select
using (
  organization_id = current_organization_id()
  and can_access_lead(lead_id)
);

drop policy if exists "organization members access property images" on property_images;

create policy "organization members view property images"
on property_images for select
using (organization_id = current_organization_id());

create policy "inventory managers create property images"
on property_images for insert
with check (
  organization_id = current_organization_id()
  and current_profile_role() in ('admin', 'sales_manager')
);

create policy "inventory managers update property images"
on property_images for update
using (
  organization_id = current_organization_id()
  and current_profile_role() in ('admin', 'sales_manager')
)
with check (
  organization_id = current_organization_id()
  and current_profile_role() in ('admin', 'sales_manager')
);

create policy "inventory managers delete property images"
on property_images for delete
using (
  organization_id = current_organization_id()
  and current_profile_role() in ('admin', 'sales_manager')
);

drop policy if exists "organization members upload property media" on storage.objects;
drop policy if exists "organization members update property media" on storage.objects;
drop policy if exists "organization members delete property media" on storage.objects;

create policy "inventory managers upload property media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'property-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and current_profile_role() in ('admin', 'sales_manager')
);

create policy "inventory managers update property media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'property-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and current_profile_role() in ('admin', 'sales_manager')
)
with check (
  bucket_id = 'property-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and current_profile_role() in ('admin', 'sales_manager')
);

create policy "inventory managers delete property media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'property-media'
  and (storage.foldername(name))[1] = current_organization_id()::text
  and current_profile_role() in ('admin', 'sales_manager')
);
