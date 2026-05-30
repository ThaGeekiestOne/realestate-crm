import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { WorkspaceNotification } from "@/lib/types";

const updateSchema = z.union([
  z.object({ notificationId: z.string().uuid() }),
  z.object({ all: z.literal(true) }),
]);

function getBearerToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
}

async function getRequestContext(request: Request) {
  const supabase = getSupabaseAdminClient();
  const token = getBearerToken(request);

  if (!supabase || !token) {
    return null;
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData.user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("id", authData.user.id)
    .single<{ id: string; organization_id: string }>();

  return profileError || !profile ? null : { supabase, profile };
}

export async function GET(request: Request) {
  const context = await getRequestContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data, error } = await context.supabase
    .from("notifications")
    .select("id, notification_type, title, body, created_at, read_at")
    .eq("organization_id", context.profile.organization_id)
    .eq("user_id", context.profile.id)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notifications: (data ?? []).map(mapNotification) });
}

export async function PATCH(request: Request) {
  const context = await getRequestContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await readJson(request));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid notification update", issues: parsed.error.flatten() }, { status: 400 });
  }

  let query = context.supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("organization_id", context.profile.organization_id)
    .eq("user_id", context.profile.id)
    .is("read_at", null);

  if ("notificationId" in parsed.data) {
    query = query.eq("id", parsed.data.notificationId);
  }

  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: true });
}

async function readJson(request: Request) {
  try {
    return await request.json() as unknown;
  } catch {
    return null;
  }
}

function mapNotification(record: {
  id: string;
  notification_type: string;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
}): WorkspaceNotification {
  return {
    id: record.id,
    type: normalizeType(record.notification_type),
    title: record.title,
    body: record.body ?? undefined,
    createdAt: record.created_at,
    read: Boolean(record.read_at),
  };
}

function normalizeType(type: string): WorkspaceNotification["type"] {
  if (["new_lead_assigned", "missed_lead_call", "followup_due", "site_visit_scheduled", "property_shared", "attendance_issue", "social_post_due"].includes(type)) {
    return type as WorkspaceNotification["type"];
  }

  return "general";
}
