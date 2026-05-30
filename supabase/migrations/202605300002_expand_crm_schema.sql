create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table properties
  add column if not exists address text,
  add column if not exists size_sqft numeric,
  add column if not exists bedrooms integer,
  add column if not exists bathrooms integer,
  add column if not exists floor text,
  add column if not exists furnishing_status text,
  add column if not exists units_available integer not null default 1,
  add column if not exists owner_developer text,
  add column if not exists amenities text[] not null default '{}',
  add column if not exists notes text,
  add column if not exists internal_tags text[] not null default '{}';

create table lead_sources (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table team_members (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations on delete cascade,
  profile_id uuid references profiles on delete cascade,
  invite_email text,
  availability_status text not null default 'available'
    check (availability_status in ('available', 'busy', 'offline')),
  last_assigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, profile_id)
);

create table property_images (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations on delete cascade,
  property_id uuid not null references properties on delete cascade,
  storage_path text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table property_documents (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations on delete cascade,
  property_id uuid not null references properties on delete cascade,
  storage_path text not null,
  document_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lead_property_shares (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations on delete cascade,
  lead_id uuid not null references leads on delete cascade,
  property_id uuid not null references properties on delete cascade,
  shared_by uuid references profiles,
  channel text not null,
  public_token uuid not null default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (public_token)
);

create table activities (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations on delete cascade,
  lead_id uuid references leads on delete cascade,
  actor_id uuid references profiles,
  activity_type text not null,
  description text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations on delete cascade,
  lead_id uuid not null references leads on delete cascade,
  sent_by uuid references profiles,
  channel text not null check (channel in ('whatsapp', 'sms', 'email')),
  provider_message_id text,
  recipient text not null,
  body text not null,
  status text not null default 'queued',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table attendance (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  check_in_time timestamptz not null default now(),
  check_out_time timestamptz,
  check_in_latitude numeric,
  check_in_longitude numeric,
  check_out_latitude numeric,
  check_out_longitude numeric,
  status text not null default 'present',
  notes text,
  selfie_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table social_posts (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations on delete cascade,
  assigned_to uuid references profiles,
  post_type text not null,
  title text not null,
  caption text,
  media_storage_paths text[] not null default '{}',
  status text not null default 'idea'
    check (status in ('idea', 'draft', 'scheduled', 'published')),
  scheduled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations on delete cascade,
  lead_id uuid references leads on delete cascade,
  assigned_to uuid references profiles,
  title text not null,
  task_type text not null,
  due_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table integration_settings (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations on delete cascade,
  provider text not null,
  settings jsonb not null default '{}',
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations on delete cascade,
  user_id uuid references profiles on delete cascade,
  notification_type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_organization_assigned_agent_idx on leads (organization_id, assigned_agent_id);
create index leads_organization_status_idx on leads (organization_id, status);
create index followups_organization_due_at_idx on followups (organization_id, due_at);
create index activities_lead_created_at_idx on activities (lead_id, created_at desc);
create index notifications_user_read_at_idx on notifications (user_id, read_at);

create or replace function current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$ select organization_id from profiles where id = auth.uid() $$;

create or replace function current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$ select role from profiles where id = auth.uid() $$;

create or replace function assign_next_sales_agent(target_organization_id uuid)
returns table (agent_id uuid, full_name text, phone text)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_member team_members%rowtype;
begin
  if auth.role() <> 'service_role' and (auth.uid() is null or target_organization_id is distinct from current_organization_id()) then
    raise exception 'Organization access denied';
  end if;

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

alter table organizations enable row level security;
alter table lead_sources enable row level security;
alter table team_members enable row level security;
alter table property_images enable row level security;
alter table property_documents enable row level security;
alter table lead_property_shares enable row level security;
alter table activities enable row level security;
alter table messages enable row level security;
alter table attendance enable row level security;
alter table social_posts enable row level security;
alter table tasks enable row level security;
alter table integration_settings enable row level security;
alter table notifications enable row level security;

create policy "members view own organization" on organizations
  for select using (id = current_organization_id());
create policy "organization members view profiles" on profiles
  for select using (organization_id = current_organization_id());
create policy "members update own profile" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid() and organization_id = current_organization_id());

create policy "organization members access lead sources" on lead_sources for all using (organization_id = current_organization_id()) with check (organization_id = current_organization_id());
create policy "organization members access team members" on team_members for select using (organization_id = current_organization_id());
create policy "organization members access property images" on property_images for all using (organization_id = current_organization_id()) with check (organization_id = current_organization_id());
create policy "organization members access property documents" on property_documents for all using (organization_id = current_organization_id()) with check (organization_id = current_organization_id());
create policy "organization members access property shares" on lead_property_shares for all using (organization_id = current_organization_id()) with check (organization_id = current_organization_id());
create policy "organization members access activities" on activities for all using (organization_id = current_organization_id()) with check (organization_id = current_organization_id());
create policy "organization members access messages" on messages for all using (organization_id = current_organization_id()) with check (organization_id = current_organization_id());
create policy "organization members access attendance" on attendance for all using (organization_id = current_organization_id()) with check (organization_id = current_organization_id());
create policy "organization members access social posts" on social_posts for all using (organization_id = current_organization_id()) with check (organization_id = current_organization_id());
create policy "organization members access tasks" on tasks for all using (organization_id = current_organization_id()) with check (organization_id = current_organization_id());
create policy "admins access integration settings" on integration_settings for all using (organization_id = current_organization_id() and current_profile_role() = 'admin') with check (organization_id = current_organization_id() and current_profile_role() = 'admin');
create policy "organization members access notifications" on notifications for all using (organization_id = current_organization_id() and (user_id is null or user_id = auth.uid())) with check (organization_id = current_organization_id());

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations', 'profiles', 'leads', 'properties', 'calls', 'followups',
    'lead_sources', 'team_members', 'property_images', 'property_documents',
    'lead_property_shares', 'activities', 'messages', 'attendance',
    'social_posts', 'tasks', 'integration_settings', 'notifications'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on %I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on %I for each row execute function set_updated_at()', table_name, table_name);
  end loop;
end;
$$;
