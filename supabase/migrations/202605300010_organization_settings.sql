alter table organizations
  add column if not exists lead_assignment_mode text not null default 'round_robin'
    check (lead_assignment_mode in ('round_robin', 'manual', 'least_busy'));

create or replace function assign_next_sales_agent(target_organization_id uuid)
returns table (agent_id uuid, full_name text, phone text)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_member team_members%rowtype;
  assignment_mode text;
begin
  if auth.role() <> 'service_role' and (auth.uid() is null or target_organization_id is distinct from current_organization_id()) then
    raise exception 'Organization access denied';
  end if;

  select lead_assignment_mode
    into assignment_mode
    from organizations
   where id = target_organization_id;

  if assignment_mode = 'manual' then
    return;
  end if;

  if assignment_mode = 'least_busy' then
    select team_members.*
      into selected_member
      from team_members
      join profiles on profiles.id = team_members.profile_id
      left join lateral (
        select count(*) as assigned_leads
          from leads
         where leads.assigned_agent_id = team_members.profile_id
           and leads.organization_id = target_organization_id
           and leads.status not in ('Won', 'Lost')
      ) workload on true
     where team_members.organization_id = target_organization_id
       and team_members.availability_status = 'available'
       and profiles.role in ('sales_manager', 'sales_agent')
     order by workload.assigned_leads asc, team_members.last_assigned_at asc nulls first, team_members.created_at asc
     limit 1
     for update of team_members skip locked;
  else
    select team_members.*
      into selected_member
      from team_members
      join profiles on profiles.id = team_members.profile_id
     where team_members.organization_id = target_organization_id
       and team_members.availability_status = 'available'
       and profiles.role in ('sales_manager', 'sales_agent')
     order by team_members.last_assigned_at asc nulls first, team_members.created_at asc
     limit 1
     for update of team_members skip locked;
  end if;

  if selected_member.id is null then
    return;
  end if;

  update team_members
     set last_assigned_at = now(),
         updated_at = now()
   where id = selected_member.id;

  return query
  select profiles.id, profiles.full_name, profiles.phone
    from profiles
   where profiles.id = selected_member.profile_id;
end;
$$;
