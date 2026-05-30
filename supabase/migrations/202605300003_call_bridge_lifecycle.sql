alter table calls
  add column if not exists lead_call_sid text,
  add column if not exists retry_count integer not null default 0;

create index if not exists calls_call_sid_idx on calls (call_sid);
create index if not exists calls_lead_call_sid_idx on calls (lead_call_sid);
create index if not exists calls_conference_sid_idx on calls (conference_sid);
