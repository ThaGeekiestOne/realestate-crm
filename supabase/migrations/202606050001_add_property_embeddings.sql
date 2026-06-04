create extension if not exists vector with schema extensions;

alter table properties
  add column if not exists embedding extensions.vector(1536),
  add column if not exists embedding_updated_at timestamptz;

create index if not exists properties_embedding_idx
  on properties
  using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 100);

create or replace function search_properties(
  query_embedding extensions.vector(1536),
  match_count int default 10,
  filter_organization_id uuid default null
)
returns table (
  id uuid,
  similarity float
)
language sql stable as $$
  select
    p.id,
    1 - (p.embedding <=> query_embedding) as similarity
  from properties p
  where
    p.embedding is not null
    and (filter_organization_id is null or p.organization_id = filter_organization_id)
  order by p.embedding <=> query_embedding
  limit match_count;
$$;
