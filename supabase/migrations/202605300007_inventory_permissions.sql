drop policy if exists "organization members access properties" on properties;

create policy "organization members view properties"
on properties for select
using (organization_id = current_organization_id());

create policy "inventory managers create properties"
on properties for insert
with check (
  organization_id = current_organization_id()
  and current_profile_role() in ('admin', 'sales_manager')
);

create policy "inventory managers update properties"
on properties for update
using (
  organization_id = current_organization_id()
  and current_profile_role() in ('admin', 'sales_manager')
)
with check (
  organization_id = current_organization_id()
  and current_profile_role() in ('admin', 'sales_manager')
);

create policy "inventory managers delete properties"
on properties for delete
using (
  organization_id = current_organization_id()
  and current_profile_role() in ('admin', 'sales_manager')
);
