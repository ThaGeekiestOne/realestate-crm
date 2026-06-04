create table if not exists ai_drafts (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references leads(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'email')),
  draft_text text not null,
  context_summary text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'sent')),
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_drafts_lead_id_idx on ai_drafts(lead_id);
create index if not exists ai_drafts_status_idx on ai_drafts(status);
create index if not exists ai_drafts_organization_id_idx on ai_drafts(organization_id);

alter table ai_drafts enable row level security;

create policy "organization members access ai drafts"
on ai_drafts for all
using (organization_id = current_organization_id())
with check (organization_id = current_organization_id());

drop trigger if exists set_ai_drafts_updated_at on ai_drafts;
create trigger set_ai_drafts_updated_at
before update on ai_drafts
for each row execute function set_updated_at();
