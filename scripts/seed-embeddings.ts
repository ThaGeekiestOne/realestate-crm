/**
 * One-time backfill: embed all properties that have no embedding yet.
 * Run: npx tsx scripts/seed-embeddings.ts
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY in .env.local.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildPropertyText, embedText, type PropertyForEmbedding } from "../src/lib/ai/embedding";

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

interface PropertyRow extends PropertyForEmbedding {
  id: string;
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

async function main() {
  const { data: properties, error } = await supabase
    .from("properties")
    .select("id, title, description, location, property_type, bedrooms, price, amenities")
    .is("embedding", null);

  if (error) {
    throw error;
  }

  const rows = (properties ?? []) as PropertyRow[];

  if (!rows.length) {
    console.log("No properties to embed.");
    return;
  }

  console.log(`Embedding ${rows.length} properties...`);

  for (const property of rows) {
    const text = buildPropertyText(property);
    const embedding = await embedText(text);
    const { error: upsertError } = await supabase
      .from("properties")
      .update({
        embedding: JSON.stringify(embedding),
        embedding_updated_at: new Date().toISOString(),
      })
      .eq("id", property.id);

    if (upsertError) {
      console.error(`Failed to update ${property.id}:`, upsertError.message);
    } else {
      console.log(`Embedded ${property.title}`);
    }

    await new Promise((resolveDelay) => {
      setTimeout(resolveDelay, 200);
    });
  }

  console.log("Done.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
