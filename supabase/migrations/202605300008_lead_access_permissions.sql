drop policy if exists "organization members access leads" on leads;

create policy "authorized members view leads"
on leads for select
using (
  organization_id = current_organization_id()
  and (
    current_profile_role() in ('admin', 'sales_manager')
    or (current_profile_role() = 'sales_agent' and assigned_agent_id = auth.uid())
  )
);

create policy "authorized members create leads"
on leads for insert
with check (
  organization_id = current_organization_id()
  and (
    current_profile_role() in ('admin', 'sales_manager')
    or (current_profile_role() = 'sales_agent' and assigned_agent_id = auth.uid())
  )
);

create policy "authorized members update leads"
on leads for update
using (
  organization_id = current_organization_id()
  and (
    current_profile_role() in ('admin', 'sales_manager')
    or (current_profile_role() = 'sales_agent' and assigned_agent_id = auth.uid())
  )
)
with check (
  organization_id = current_organization_id()
  and (
    current_profile_role() in ('admin', 'sales_manager')
    or (current_profile_role() = 'sales_agent' and assigned_agent_id = auth.uid())
  )
);

create policy "admins delete leads"
on leads for delete
using (
  organization_id = current_organization_id()
  and current_profile_role() = 'admin'
);

drop policy if exists "organization members access followups" on followups;

create policy "authorized members view followups"
on followups for select
using (
  organization_id = current_organization_id()
  and (
    current_profile_role() in ('admin', 'sales_manager')
    or (current_profile_role() = 'sales_agent' and assigned_to = auth.uid())
  )
);

create policy "authorized members create followups"
on followups for insert
with check (
  organization_id = current_organization_id()
  and (
    current_profile_role() in ('admin', 'sales_manager')
    or (current_profile_role() = 'sales_agent' and assigned_to = auth.uid())
  )
);

create policy "authorized members update followups"
on followups for update
using (
  organization_id = current_organization_id()
  and (
    current_profile_role() in ('admin', 'sales_manager')
    or (current_profile_role() = 'sales_agent' and assigned_to = auth.uid())
  )
)
with check (
  organization_id = current_organization_id()
  and (
    current_profile_role() in ('admin', 'sales_manager')
    or (current_profile_role() = 'sales_agent' and assigned_to = auth.uid())
  )
);

create policy "lead managers delete followups"
on followups for delete
using (
  organization_id = current_organization_id()
  and current_profile_role() in ('admin', 'sales_manager')
);
