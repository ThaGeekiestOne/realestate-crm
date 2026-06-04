import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { ProfileRole } from "@/lib/auth-types";
import { embedPropertyById } from "@/lib/ai/property-embedding";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const requestSchema = z.object({
  propertyId: z.string().uuid(),
});

function getBearerToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
}

function canManageInventory(role: ProfileRole) {
  return role === "admin" || role === "sales_manager";
}

async function isAuthorizedForProperty(request: NextRequest, propertyId: string) {
  const internalSecret = request.headers.get("x-internal-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (process.env.CRON_SECRET && internalSecret === process.env.CRON_SECRET) {
    return true;
  }

  const supabase = getSupabaseAdminClient();
  const token = getBearerToken(request);

  if (!supabase || !token) {
    return false;
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData.user) {
    return false;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", authData.user.id)
    .single<{ id: string; organization_id: string; role: ProfileRole }>();

  if (profileError || !profile || !canManageInventory(profile.role)) {
    return false;
  }

  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle<{ id: string }>();

  return Boolean(property);
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
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!await isAuthorizedForProperty(req, parsed.data.propertyId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await embedPropertyById(parsed.data.propertyId);
    return NextResponse.json({ ok: true, propertyId: result.propertyId });
  } catch (error) {
    console.error("[ai/embed-property]", error);
    return NextResponse.json({ error: "Embedding failed" }, { status: 500 });
  }
}
