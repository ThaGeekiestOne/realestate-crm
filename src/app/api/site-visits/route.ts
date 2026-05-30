import { NextResponse } from "next/server";
import { z } from "zod";
import type { ProfileRole } from "@/lib/auth-types";
import { getInitials } from "@/lib/auth-types";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { SiteVisit } from "@/lib/types";

const createSchema = z.object({
  leadId: z.string().uuid(),
  assigneeId: z.string().uuid(),
  location: z.string().trim().min(2).max(240),
  scheduledAt: z.string().datetime(),
  notes: z.string().trim().max(1000).default(""),
});
const updateSchema = z.object({
  siteVisitId: z.string().uuid(),
  notes: z.string().trim().max(1000),
  action: z.enum(["save-notes", "complete"]),
});

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
    .select("id, organization_id, role")
    .eq("id", authData.user.id)
    .single<{ id: string; organization_id: string; role: ProfileRole }>();

  return profileError || !profile ? null : { supabase, profile };
}

export async function GET(request: Request) {
  const context = await getRequestContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!["admin", "sales_manager", "field_executive"].includes(context.profile.role)) {
    return NextResponse.json({ siteVisits: [] });
  }

  let query = context.supabase
    .from("tasks")
    .select("id, lead_id, assigned_to, due_at, completed_at, notes, metadata, leads(full_name), profiles(full_name)")
    .eq("organization_id", context.profile.organization_id)
    .eq("task_type", "site_visit")
    .order("due_at", { ascending: true });

  if (!["admin", "sales_manager"].includes(context.profile.role)) {
    query = query.eq("assigned_to", context.profile.id);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ siteVisits: (data ?? []).map(mapSiteVisit) });
}

export async function POST(request: Request) {
  const context = await getRequestContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!["admin", "sales_manager"].includes(context.profile.role)) {
    return NextResponse.json({ error: "Only admins and sales managers can schedule site visits" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await readJson(request));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid site visit", issues: parsed.error.flatten() }, { status: 400 });
  }

  const [{ data: lead, error: leadError }, { data: assignee, error: assigneeError }] = await Promise.all([
    context.supabase
      .from("leads")
      .select("id, full_name")
      .eq("organization_id", context.profile.organization_id)
      .eq("id", parsed.data.leadId)
      .single<{ id: string; full_name: string }>(),
    context.supabase
      .from("profiles")
      .select("id, full_name")
      .eq("organization_id", context.profile.organization_id)
      .eq("id", parsed.data.assigneeId)
      .eq("role", "field_executive")
      .single<{ id: string; full_name: string }>(),
  ]);

  if (leadError || !lead) {
    return NextResponse.json({ error: "Select an existing lead before scheduling a site visit" }, { status: 400 });
  }

  if (assigneeError || !assignee) {
    return NextResponse.json({ error: "Select a field executive from your organization" }, { status: 400 });
  }

  const { data, error } = await context.supabase
    .from("tasks")
    .insert({
      organization_id: context.profile.organization_id,
      lead_id: lead.id,
      assigned_to: assignee.id,
      title: `Site visit: ${lead.full_name}`,
      task_type: "site_visit",
      due_at: parsed.data.scheduledAt,
      notes: parsed.data.notes || null,
      metadata: { location: parsed.data.location },
    })
    .select("id, lead_id, assigned_to, due_at, completed_at, notes, metadata, leads(full_name), profiles(full_name)")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Unable to schedule site visit" }, { status: 500 });
  }

  await Promise.all([
    context.supabase.from("notifications").insert({
      organization_id: context.profile.organization_id,
      user_id: assignee.id,
      notification_type: "site_visit_scheduled",
      title: "Site visit assigned",
      body: `${lead.full_name} at ${parsed.data.location}.`,
      metadata: { siteVisitId: data.id, leadId: lead.id },
    }),
    context.supabase.from("activities").insert({
      organization_id: context.profile.organization_id,
      lead_id: lead.id,
      actor_id: context.profile.id,
      activity_type: "site_visit_scheduled",
      description: `${lead.full_name} site visit assigned to ${assignee.full_name}`,
      metadata: { siteVisitId: data.id, location: parsed.data.location },
    }),
  ]);

  return NextResponse.json({ siteVisit: mapSiteVisit(data) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await getRequestContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!["admin", "sales_manager", "field_executive"].includes(context.profile.role)) {
    return NextResponse.json({ error: "Only field executives and managers can update site visits" }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(await readJson(request));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid site visit update", issues: parsed.error.flatten() }, { status: 400 });
  }

  let taskQuery = context.supabase
    .from("tasks")
    .select("id, lead_id, assigned_to")
    .eq("id", parsed.data.siteVisitId)
    .eq("organization_id", context.profile.organization_id)
    .eq("task_type", "site_visit");

  if (!["admin", "sales_manager"].includes(context.profile.role)) {
    taskQuery = taskQuery.eq("assigned_to", context.profile.id);
  }

  const { data: task, error: taskError } = await taskQuery.single<{ id: string; lead_id: string | null; assigned_to: string | null }>();

  if (taskError || !task) {
    return NextResponse.json({ error: "Site visit not found or not assigned to you" }, { status: 404 });
  }

  const completedAt = parsed.data.action === "complete" ? new Date().toISOString() : undefined;
  const { data, error } = await context.supabase
    .from("tasks")
    .update({
      notes: parsed.data.notes || null,
      ...(completedAt ? { completed_at: completedAt } : {}),
    })
    .eq("id", task.id)
    .eq("organization_id", context.profile.organization_id)
    .select("id, lead_id, assigned_to, due_at, completed_at, notes, metadata, leads(full_name), profiles(full_name)")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Unable to update site visit" }, { status: 500 });
  }

  await context.supabase.from("activities").insert({
    organization_id: context.profile.organization_id,
    lead_id: task.lead_id,
    actor_id: context.profile.id,
    activity_type: completedAt ? "site_visit_completed" : "site_visit_notes_updated",
    description: completedAt ? "Site visit marked complete" : "Site visit notes updated",
    metadata: { siteVisitId: task.id },
  });

  return NextResponse.json({ siteVisit: mapSiteVisit(data) });
}

function mapSiteVisit(record: {
  id: string;
  lead_id: string | null;
  assigned_to: string | null;
  due_at: string | null;
  completed_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  leads: { full_name: string } | { full_name: string }[] | null;
  profiles: { full_name: string } | { full_name: string }[] | null;
}): SiteVisit {
  const lead = Array.isArray(record.leads) ? record.leads[0] : record.leads;
  const assignee = Array.isArray(record.profiles) ? record.profiles[0] : record.profiles;
  const leadName = lead?.full_name ?? "Unassigned lead";

  return {
    id: record.id,
    lead: leadName,
    leadId: record.lead_id ?? undefined,
    initials: getInitials(leadName),
    location: typeof record.metadata?.location === "string" ? record.metadata.location : "Location not set",
    scheduledFor: formatDateTime(record.due_at),
    assignee: assignee?.full_name ?? "Unassigned",
    assigneeId: record.assigned_to ?? undefined,
    notes: record.notes ?? "",
    status: record.completed_at ? "Completed" : "Scheduled",
    completedAt: record.completed_at ? formatDateTime(record.completed_at) : undefined,
  };
}

function formatDateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "Not scheduled";
}

async function readJson(request: Request) {
  try {
    return await request.json() as unknown;
  } catch {
    return null;
  }
}
