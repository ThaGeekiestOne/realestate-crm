create extension if not exists "uuid-ossp";

create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  organization_id uuid not null references organizations on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'sales_manager', 'sales_agent', 'field_executive', 'social_media_manager')),
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table leads (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations on delete cascade,
  assigned_agent_id uuid references profiles,
  full_name text not null,
  phone text not null,
  email text,
  source text not null default 'Manual',
  property_type text,
  budget_min numeric,
  budget_max numeric,
  preferred_location text,
  status text not null default 'New',
  temperature text not null default 'Warm',
  notes text,
  next_followup_at timestamptz,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table properties (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations on delete cascade,
  title text not null,
  location text not null,
  property_type text,
  price numeric,
  availability_status text not null default 'Available',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table calls (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations on delete cascade,
  lead_id uuid not null references leads on delete cascade,
  agent_id uuid references profiles,
  call_sid text,
  conference_sid text,
  status text not null,
  duration integer,
  recording_url text,
  outcome text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table followups (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations on delete cascade,
  lead_id uuid not null references leads on delete cascade,
  assigned_to uuid references profiles,
  due_at timestamptz not null,
  channel text,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table leads enable row level security;
alter table properties enable row level security;
alter table calls enable row level security;
alter table followups enable row level security;

create or replace function current_organization_id()
returns uuid language sql stable security definer
as $$ select organization_id from profiles where id = auth.uid() $$;

create policy "organization members access leads" on leads for all using (organization_id = current_organization_id()) with check (organization_id = current_organization_id());
create policy "organization members access properties" on properties for all using (organization_id = current_organization_id()) with check (organization_id = current_organization_id());
create policy "organization members access calls" on calls for all using (organization_id = current_organization_id()) with check (organization_id = current_organization_id());
create policy "organization members access followups" on followups for all using (organization_id = current_organization_id()) with check (organization_id = current_organization_id());
