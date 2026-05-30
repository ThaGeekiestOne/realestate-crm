import { NextResponse } from "next/server";
import { z } from "zod";
import type { ProfileRole } from "@/lib/auth-types";
import { canAccessLead, canManageLeadAssignment } from "@/lib/lead-access";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { LeadTimelineItem } from "@/lib/types";
import { triggerBridgeCall } from "@/services/call-service";

const leadStatuses = ["New", "Contacted", "Interested", "Site Visit", "Negotiation", "Won", "Lost", "Not Responding"] as const;
const leadTemperatures = ["Hot", "Warm", "Cold"] as const;

const callSchema = z.object({
  action: z.literal("call"),
  leadId: z.string().uuid(),
});

const updateSchema = z.object({
  action: z.literal("update"),
  leadId: z.string().uuid(),
  status: z.enum(leadStatuses),
  temperature: z.enum(leadTemperatures),
  notes: z.string().trim().max(3000),
  assignedAgentId: z.string().uuid().optional(),
});

const actionSchema = z.discriminatedUnion("action", [callSchema, updateSchema]);

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
  const leadId = new URL(request.url).searchParams.get("leadId");

  if (!context) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!leadId || !z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: "A valid leadId is required" }, { status: 400 });
  }

  if (!await hasAccessibleOrganizationLead(context.supabase, context.profile, leadId)) {
    return NextResponse.json({ error: "Lead not found or not assigned to you" }, { status: 404 });
  }

  const [activities, calls, messages, followups, shares] = await Promise.all([
    context.supabase.from("activities").select("id, activity_type, description, created_at").eq("lead_id", leadId),
    context.supabase.from("calls").select("id, status, duration, outcome, created_at").eq("lead_id", leadId),
    context.supabase.from("messages").select("id, channel, status, created_at").eq("lead_id", leadId),
    context.supabase.from("followups").select("id, channel, notes, due_at, completed_at, created_at").eq("lead_id", leadId),
    context.supabase.from("lead_property_shares").select("id, channel, created_at, properties(title)").eq("lead_id", leadId),
  ]);
  const error = activities.error ?? calls.error ?? messages.error ?? followups.error ?? shares.error;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const timeline = [
    ...(activities.data ?? []).map((item) => ({
      id: `activity-${item.id}`,
      icon: activityIcon(item.activity_type),
      title: item.description,
      detail: formatLabel(item.activity_type),
      timestamp: item.created_at,
    })),
    ...(calls.data ?? []).map((item) => ({
      id: `call-${item.id}`,
      icon: "phone" as const,
      title: `Call ${formatLabel(item.status)}`,
      detail: item.duration ? `${item.duration}s${item.outcome ? ` - ${formatLabel(item.outcome)}` : ""}` : formatLabel(item.outcome ?? "Bridge call"),
      timestamp: item.created_at,
    })),
    ...(messages.data ?? []).map((item) => ({
      id: `message-${item.id}`,
      icon: "message" as const,
      title: `${formatLabel(item.channel)} message ${formatLabel(item.status)}`,
      detail: "Follow-up message",
      timestamp: item.created_at,
    })),
    ...(followups.data ?? []).map((item) => ({
      id: `followup-${item.id}`,
      icon: "followup" as const,
      title: item.completed_at ? "Follow-up completed" : "Follow-up scheduled",
      detail: `${item.notes ?? formatLabel(item.channel ?? "Call")} - ${new Date(item.due_at).toLocaleString("en-IN")}`,
      timestamp: item.created_at,
    })),
    ...(shares.data ?? []).map((item) => {
      const property = Array.isArray(item.properties) ? item.properties[0] : item.properties;
      return {
        id: `share-${item.id}`,
        icon: "share" as const,
        title: "Property details shared",
        detail: `${property?.title ?? "Property"} via ${formatLabel(item.channel)}`,
        timestamp: item.created_at,
      };
    }),
  ].sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp)).slice(0, 30);

  return NextResponse.json({ timeline });
}

export async function POST(request: Request) {
  const context = await getRequestContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const parsed = actionSchema.safeParse(await readJson(request));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lead action", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { data: lead, error: leadError } = await context.supabase
    .from("leads")
    .select("id, full_name, phone, source, assigned_agent_id")
    .eq("id", parsed.data.leadId)
    .eq("organization_id", context.profile.organization_id)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found in your organization" }, { status: 404 });
  }

  if (!canAccessLead(context.profile.role, context.profile.id, lead.assigned_agent_id)) {
    return NextResponse.json({ error: "Lead not found or not assigned to you" }, { status: 404 });
  }

  if (parsed.data.action === "call") {
    return startBridgeCall(context, lead);
  }

  if (parsed.data.assignedAgentId && parsed.data.assignedAgentId !== lead.assigned_agent_id && !canManageLeadAssignment(context.profile.role)) {
    return NextResponse.json({ error: "Only admins and sales managers can reassign leads" }, { status: 403 });
  }

  let agentName = "Unassigned";
  if (parsed.data.assignedAgentId) {
    const { data: agent, error: agentError } = await context.supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", parsed.data.assignedAgentId)
      .eq("organization_id", context.profile.organization_id)
      .in("role", ["sales_manager", "sales_agent"])
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: "Assigned sales agent not found in your organization" }, { status: 400 });
    }

    agentName = agent.full_name;
  }

  const databaseStatus = parsed.data.status === "Site Visit" ? "Site Visit Scheduled" : parsed.data.status;
  const { error: updateError } = await context.supabase
    .from("leads")
    .update({
      assigned_agent_id: parsed.data.assignedAgentId ?? lead.assigned_agent_id,
      status: databaseStatus,
      temperature: parsed.data.temperature,
      notes: parsed.data.notes,
    })
    .eq("id", lead.id)
    .eq("organization_id", context.profile.organization_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await context.supabase.from("activities").insert({
    organization_id: context.profile.organization_id,
    lead_id: lead.id,
    actor_id: context.profile.id,
    activity_type: "lead_updated",
    description: `${lead.full_name} updated to ${parsed.data.status}`,
    metadata: { temperature: parsed.data.temperature, assignedAgentId: parsed.data.assignedAgentId },
  });

  if (parsed.data.status === "Site Visit") {
    await context.supabase.from("notifications").insert({
      organization_id: context.profile.organization_id,
      user_id: parsed.data.assignedAgentId ?? lead.assigned_agent_id ?? context.profile.id,
      notification_type: "site_visit_scheduled",
      title: "Site visit scheduled",
      body: `${lead.full_name} moved to the site visit stage.`,
      metadata: { leadId: lead.id },
    });
  }

  return NextResponse.json({
    lead: {
      status: parsed.data.status,
      temperature: parsed.data.temperature,
      note: parsed.data.notes,
      agent: parsed.data.assignedAgentId ? agentName : undefined,
    },
  });
}

async function startBridgeCall(
  context: NonNullable<Awaited<ReturnType<typeof getRequestContext>>>,
  lead: { id: string; full_name: string; phone: string; source: string; assigned_agent_id: string | null },
) {
  if (!lead.assigned_agent_id) {
    return NextResponse.json({ error: "Assign a sales agent before starting a call" }, { status: 400 });
  }

  const { data: agent, error: agentError } = await context.supabase
    .from("profiles")
    .select("id, phone")
    .eq("id", lead.assigned_agent_id)
    .eq("organization_id", context.profile.organization_id)
    .single();

  if (agentError || !agent?.phone) {
    return NextResponse.json({ error: "The assigned agent does not have a phone number" }, { status: 400 });
  }

  const { data: callLog, error: callLogError } = await context.supabase
    .from("calls")
    .insert({
      organization_id: context.profile.organization_id,
      lead_id: lead.id,
      agent_id: agent.id,
      status: "initiating",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (callLogError || !callLog) {
    return NextResponse.json({ error: callLogError?.message ?? "Unable to create call log" }, { status: 500 });
  }

  try {
    const call = await triggerBridgeCall({
      callId: callLog.id,
      leadId: lead.id,
      leadName: lead.full_name,
      leadPhone: lead.phone,
      agentId: agent.id,
      agentPhone: agent.phone,
      source: lead.source,
    });

    await Promise.all([
      context.supabase.from("calls").update({ call_sid: call.callSid, status: call.status }).eq("id", callLog.id),
      context.supabase.from("activities").insert({
        organization_id: context.profile.organization_id,
        lead_id: lead.id,
        actor_id: context.profile.id,
        activity_type: "bridge_call_started",
        description: `Bridge call started for ${lead.full_name}`,
        metadata: { callId: callLog.id, callSid: call.callSid, dryRun: call.dryRun },
      }),
    ]);

    return NextResponse.json({ status: call.status });
  } catch (error) {
    await context.supabase.from("calls").update({ status: "failed", outcome: "provider_error", ended_at: new Date().toISOString() }).eq("id", callLog.id);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start bridge call" }, { status: 502 });
  }
}

async function hasAccessibleOrganizationLead(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  profile: { id: string; organization_id: string; role: ProfileRole },
  leadId: string,
) {
  const { data } = await supabase.from("leads").select("assigned_agent_id").eq("id", leadId).eq("organization_id", profile.organization_id).maybeSingle<{ assigned_agent_id: string | null }>();
  return Boolean(data && canAccessLead(profile.role, profile.id, data.assigned_agent_id));
}

async function readJson(request: Request) {
  try {
    return await request.json() as unknown;
  } catch {
    return null;
  }
}

function activityIcon(type: string): LeadTimelineItem["icon"] {
  if (type.includes("call")) return "phone";
  if (type.includes("share")) return "share";
  if (type.includes("message")) return "message";
  if (type.includes("followup")) return "followup";
  return "lead";
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
