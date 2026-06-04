import { embedText } from "./embedding";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export interface SearchResult {
  id: string;
  similarity: number;
}

export interface SearchFilters {
  organizationId?: string;
  matchCount?: number;
}

interface SearchPropertiesRow {
  id: string;
  similarity: number;
}

export async function semanticSearchProperties(query: string, filters: SearchFilters = {}): Promise<SearchResult[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase service role client is not configured");
  }

  const embedding = await embedText(query);
  const { data, error } = await supabase.rpc("search_properties", {
    query_embedding: JSON.stringify(embedding),
    match_count: filters.matchCount ?? 10,
    filter_organization_id: filters.organizationId ?? null,
  });

  if (error) {
    throw new Error(`pgvector search failed: ${error.message}`);
  }

  return ((data ?? []) as SearchPropertiesRow[]).map((row) => ({
    id: row.id,
    similarity: row.similarity,
  }));
}
