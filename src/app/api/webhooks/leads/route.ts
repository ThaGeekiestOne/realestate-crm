import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { triggerBridgeCall } from "@/services/call-service";
import { assignRoundRobinAgent } from "@/services/lead-assignment-service";

const leadSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional(),
  source: z.string().default("Webhook"),
  propertyType: z.string().optional(),
  budgetMin: z.number().optional(),
  budgetMax: z.number().optional(),
  preferredLocation: z.string().optional(),
  notes: z.string().optional(),
});

function isAuthorized(request: Request) {
  const webhookSecret = process.env.LEAD_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return true;
  }

  const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return request.headers.get("x-webhook-secret") === webhookSecret || bearerToken === webhookSecret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lead payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const organizationId = process.env.SUPABASE_DEFAULT_ORGANIZATION_ID;

  if (supabase && organizationId) {
    const { data: assignedAgents, error: assignmentError } = await supabase.rpc("assign_next_sales_agent", {
      target_organization_id: organizationId,
    });
    const agent = assignedAgents?.[0];

    if (assignmentError) {
      console.error("Lead assignment failed", assignmentError);
      return NextResponse.json({ error: "Lead assignment failed" }, { status: 500 });
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        organization_id: organizationId,
        assigned_agent_id: agent?.agent_id ?? null,
        full_name: parsed.data.fullName,
        phone: parsed.data.phone,
        email: parsed.data.email,
        source: parsed.data.source,
        property_type: parsed.data.propertyType,
        budget_min: parsed.data.budgetMin,
        budget_max: parsed.data.budgetMax,
        preferred_location: parsed.data.preferredLocation,
        notes: parsed.data.notes,
      })
      .select()
      .single();

    if (leadError) {
      console.error("Lead persistence failed", leadError);
      return NextResponse.json({ error: "Lead persistence failed" }, { status: 500 });
    }

    if (!agent) {
      const { data: managers } = await supabase
        .from("profiles")
        .select("id")
        .eq("organization_id", organizationId)
        .in("role", ["admin", "sales_manager"]);
      const { error: activityError } = await supabase.from("activities").insert({
        organization_id: organizationId,
        lead_id: lead.id,
        activity_type: "lead_created",
        description: `Lead imported from ${lead.source} and queued for manual assignment`,
        metadata: { assignmentPending: true },
      });
      const { error: notificationError } = managers?.length ? await supabase.from("notifications").insert(
        managers.map((manager) => ({
          organization_id: organizationId,
          user_id: manager.id,
          notification_type: "lead_assignment_pending",
          title: "Lead awaiting assignment",
          body: `${lead.full_name} from ${lead.source} needs an agent.`,
          metadata: { leadId: lead.id },
        })),
      ) : { error: null };

      if (activityError || notificationError) {
        console.error("Manual assignment audit persistence failed", { activityError, notificationError });
      }

      return NextResponse.json({ lead, assignedAgent: null, call: null, assignmentPending: true, persistence: "supabase" }, { status: 201 });
    }

    const { data: callLog, error: callLogError } = await supabase
      .from("calls")
      .insert({
        organization_id: organizationId,
        lead_id: lead.id,
        agent_id: agent.agent_id,
        status: "initiating",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (callLogError) {
      console.error("Call log creation failed", callLogError);
      return NextResponse.json({ error: "Call log creation failed", leadId: lead.id }, { status: 500 });
    }

    let call;

    try {
      call = await triggerBridgeCall({
        organizationId,
        callId: callLog.id,
        leadId: lead.id,
        leadName: lead.full_name,
        leadPhone: lead.phone,
        agentId: agent.agent_id,
        agentPhone: agent.phone ?? "",
        source: lead.source,
      });
    } catch (error) {
      console.error("Bridge call creation failed", error);
      await supabase
        .from("calls")
        .update({
          status: "failed",
          outcome: "provider_error",
          ended_at: new Date().toISOString(),
        })
        .eq("id", callLog.id);
      return NextResponse.json({ error: "Bridge call creation failed", leadId: lead.id }, { status: 502 });
    }

    const { error: callUpdateError } = await supabase
      .from("calls")
      .update({
        call_sid: call.callSid,
        status: call.status,
      })
      .eq("id", callLog.id);
    const { error: activityError } = await supabase.from("activities").insert({
      organization_id: organizationId,
      lead_id: lead.id,
      activity_type: "lead_created",
      description: `Lead imported from ${lead.source} and assigned to ${agent.full_name}`,
      metadata: { callSid: call.callSid, dryRun: call.dryRun },
    });
    const { error: notificationError } = await supabase.from("notifications").insert({
      organization_id: organizationId,
      user_id: agent.agent_id,
      notification_type: "new_lead_assigned",
      title: "New lead assigned",
      body: `${lead.full_name} from ${lead.source}`,
      metadata: { leadId: lead.id },
    });

    if (callUpdateError || activityError || notificationError) {
      console.error("Lead audit persistence failed", { callUpdateError, activityError, notificationError });
      return NextResponse.json({ error: "Lead created but audit logging failed", leadId: lead.id }, { status: 500 });
    }

    return NextResponse.json({ lead, assignedAgent: agent, call, persistence: "supabase" }, { status: 201 });
  }

  const lead = { id: `LD-${Date.now()}`, ...parsed.data };
  const agent = assignRoundRobinAgent();
  const call = await triggerBridgeCall({
    leadId: lead.id,
    leadName: lead.fullName,
    leadPhone: lead.phone,
    agentId: agent.id,
    agentPhone: agent.phone,
    source: lead.source,
  });

  return NextResponse.json({ lead, assignedAgent: agent, call, persistence: "dry-run" }, { status: 201 });
}
