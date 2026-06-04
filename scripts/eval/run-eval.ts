/**
 * RAG evaluation: measures whether semantic search returns relevant results.
 * Run: npx tsx scripts/eval/run-eval.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { embedText } from "../../src/lib/ai/embedding";
import { goldenDataset } from "../../src/lib/ai/eval/golden-dataset";

function loadEnvLocal() {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf8");

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separator = trimmed.indexOf("=");

      if (separator === -1) {
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // The script can also be run with env vars supplied by the shell or CI.
  }
}

interface EvalProperty {
  title?: string | null;
  location?: string | null;
  property_type?: string | null;
  bedrooms?: number | string | null;
}

interface EvalResult {
  query: string;
  pass: boolean;
  topResult?: string;
  reason?: string;
}

interface SearchResult {
  id: string;
  similarity: number;
}

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function semanticSearchProperties(query: string, matchCount: number): Promise<SearchResult[]> {
  const embedding = await embedText(query);
  const { data, error } = await supabase.rpc("search_properties", {
    query_embedding: JSON.stringify(embedding),
    match_count: matchCount,
    filter_organization_id: null,
  });

  if (error) {
    throw new Error(`pgvector search failed: ${error.message}`);
  }

  return ((data ?? []) as SearchResult[]).map((row) => ({
    id: row.id,
    similarity: row.similarity,
  }));
}

async function main() {
  let passed = 0;
  const results: EvalResult[] = [];

  for (const testCase of goldenDataset) {
    const matches = await semanticSearchProperties(testCase.query, testCase.expectedMaxResults);

    if (!matches.length) {
      results.push({ query: testCase.query, pass: false, reason: "No results returned" });
      continue;
    }

    const { data: property } = await supabase
      .from("properties")
      .select("title, location, property_type, bedrooms")
      .eq("id", matches[0].id)
      .single();

    if (!property) {
      results.push({ query: testCase.query, pass: false, reason: "Top result not found in DB" });
      continue;
    }

    const typedProperty = property as EvalProperty;
    const haystack = [typedProperty.title, typedProperty.location, typedProperty.property_type, String(typedProperty.bedrooms ?? "")]
      .join(" ")
      .toLowerCase();
    const keywordHits = testCase.expectedKeywords.filter((keyword) => haystack.includes(keyword.toLowerCase()));
    const pass = keywordHits.length >= Math.ceil(testCase.expectedKeywords.length / 2);

    results.push({
      query: testCase.query,
      pass,
      topResult: typedProperty.title ?? "Untitled property",
      reason: pass
        ? undefined
        : `Keywords not found: ${testCase.expectedKeywords.filter((keyword) => !haystack.includes(keyword.toLowerCase())).join(", ")}`,
    });

    if (pass) {
      passed += 1;
    }
  }

  console.log("\n=== RAG Evaluation Results ===\n");

  for (const result of results) {
    console.log(`${result.pass ? "PASS" : "FAIL"} "${result.query}"`);

    if (result.topResult) {
      console.log(`  Top result: ${result.topResult}`);
    }

    if (result.reason) {
      console.log(`  ${result.reason}`);
    }
  }

  const score = passed / goldenDataset.length;
  console.log(`\nScore: ${passed}/${goldenDataset.length} (${(score * 100).toFixed(0)}%)`);

  if (score < 0.8) {
    console.error("\nScore below 0.80 threshold. Do not deploy.");
    process.exit(1);
  }

  console.log("\nScore meets threshold. Safe to deploy.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
