alter table tasks
  add column if not exists metadata jsonb not null default '{}';

create index if not exists tasks_organization_type_due_at_idx
  on tasks (organization_id, task_type, due_at);

drop policy if exists "organization members access tasks" on tasks;

create policy "authorized members view tasks"
on tasks for select
using (
  organization_id = current_organization_id()
  and (
    current_profile_role() in ('admin', 'sales_manager')
    or assigned_to = auth.uid()
  )
);

create policy "task managers create tasks"
on tasks for insert
with check (
  organization_id = current_organization_id()
  and current_profile_role() in ('admin', 'sales_manager')
);

create policy "authorized members update tasks"
on tasks for update
using (
  organization_id = current_organization_id()
  and (
    current_profile_role() in ('admin', 'sales_manager')
    or (current_profile_role() = 'field_executive' and assigned_to = auth.uid())
  )
)
with check (
  organization_id = current_organization_id()
  and (
    current_profile_role() in ('admin', 'sales_manager')
    or (current_profile_role() = 'field_executive' and assigned_to = auth.uid())
  )
);

create policy "task managers delete tasks"
on tasks for delete
using (
  organization_id = current_organization_id()
  and current_profile_role() in ('admin', 'sales_manager')
);
