import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for embeddings");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });
  }

  return openaiClient;
}

export async function embedText(text: string): Promise<number[]> {
  const response = await getOpenAIClient().embeddings.create({
    model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    input: text.slice(0, 8000),
  });
  const embedding = response.data[0]?.embedding;

  if (!embedding) {
    throw new Error("Embedding response did not include vector data");
  }

  return embedding;
}

export interface PropertyForEmbedding {
  title: string;
  description?: string | null;
  location?: string | null;
  property_type?: string | null;
  bedrooms?: number | null;
  price?: number | null;
  amenities?: string[] | null;
}

export function buildPropertyText(property: PropertyForEmbedding): string {
  const parts = [
    property.title,
    property.description,
    property.location,
    property.property_type,
    property.bedrooms != null ? `${property.bedrooms} BHK` : null,
    property.price != null ? `INR ${property.price.toLocaleString("en-IN")}` : null,
    property.amenities?.join(", "),
  ];

  return parts.filter((part): part is string => Boolean(part)).join(". ");
}
