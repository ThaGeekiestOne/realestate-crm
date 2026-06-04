import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { ProfileRole } from "@/lib/auth-types";
import { tracedSearch } from "@/lib/ai/tracing";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const requestSchema = z.object({
  query: z.string().min(1).max(500),
  matchCount: z.number().int().min(1).max(50).optional().default(10),
});

interface RankedProperty {
  id: string;
  similarity: number;
}

function getBearerToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
}

function canSearchInventory(role: ProfileRole) {
  return ["admin", "sales_manager", "sales_agent", "field_executive"].includes(role);
}

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const token = getBearerToken(req);

  if (!supabase || !token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", authData.user.id)
    .single<{ id: string; organization_id: string; role: ProfileRole }>();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Workspace profile not found" }, { status: 403 });
  }

  if (!canSearchInventory(profile.role)) {
    return NextResponse.json({ error: "Inventory search is not available for your role" }, { status: 403 });
  }

  try {
    const { query, matchCount } = parsed.data;
    const searchResults = await tracedSearch(query, { organizationId: profile.organization_id, matchCount });

    if (searchResults.length === 0) {
      return NextResponse.json({ properties: [] });
    }

    const ids = searchResults.map((result) => result.id);
    const { data: properties, error } = await supabase
      .from("properties")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .in("id", ids);

    if (error) {
      throw error;
    }

    const similarityMap = new Map(searchResults.map((result) => [result.id, result.similarity]));
    const ranked = ((properties ?? []) as RankedProperty[])
      .map((property) => ({ ...property, similarity: similarityMap.get(property.id) ?? 0 }))
      .sort((a, b) => b.similarity - a.similarity);

    return NextResponse.json({ properties: ranked });
  } catch (error) {
    console.error("[ai/search]", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
