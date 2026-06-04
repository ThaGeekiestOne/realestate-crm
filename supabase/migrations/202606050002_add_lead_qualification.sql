alter table leads
  add column if not exists qualification_status text
    check (qualification_status in ('pending', 'in_progress', 'complete', 'failed'))
    default 'pending',
  add column if not exists qualified_budget_min bigint,
  add column if not exists qualified_budget_max bigint,
  add column if not exists qualified_locations text[],
  add column if not exists qualified_timeline text,
  add column if not exists qualified_property_type text,
  add column if not exists qualification_sentiment text,
  add column if not exists qualification_call_id text,
  add column if not exists qualification_transcript text,
  add column if not exists qualification_completed_at timestamptz;
