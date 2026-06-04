import { buildPropertyText, embedText, type PropertyForEmbedding } from "./embedding";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

interface EmbeddableProperty extends PropertyForEmbedding {
  id: string;
}

export async function embedPropertyById(propertyId: string) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase service role client is not configured");
  }

  const { data: property, error } = await supabase
    .from("properties")
    .select("id, title, description, location, property_type, bedrooms, price, amenities")
    .eq("id", propertyId)
    .single<EmbeddableProperty>();

  if (error || !property) {
    throw new Error("Property not found");
  }

  const text = buildPropertyText(property);
  const embedding = await embedText(text);
  const { error: updateError } = await supabase
    .from("properties")
    .update({
      embedding: JSON.stringify(embedding),
      embedding_updated_at: new Date().toISOString(),
    })
    .eq("id", property.id);

  if (updateError) {
    throw updateError;
  }

  return { propertyId: property.id };
}
