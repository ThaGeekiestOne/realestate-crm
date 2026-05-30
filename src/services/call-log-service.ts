import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { triggerBridgeCall } from "@/services/call-service";

export interface BridgeCallContext {
  callId: string;
  organizationId: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  leadSource: string;
  agentId: string | null;
  status: string;
  retryCount: number;
}

export async function getBridgeCallContext(callId: string) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("calls")
    .select("id, organization_id, agent_id, status, retry_count, leads!inner(id, full_name, phone, source)")
    .eq("id", callId)
    .single();

  if (error) {
    console.error("Unable to load bridge call context", error);
    return null;
  }

  const lead = Array.isArray(data.leads) ? data.leads[0] : data.leads;

  return {
    callId: data.id,
    organizationId: data.organization_id,
    leadId: lead.id,
    leadName: lead.full_name,
    leadPhone: lead.phone,
    leadSource: lead.source,
    agentId: data.agent_id,
    status: data.status,
    retryCount: data.retry_count,
  } satisfies BridgeCallContext;
}

export async function updateCallLog(callId: string, values: Record<string, unknown>) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("calls").update(values).eq("id", callId);

  if (error) {
    console.error("Unable to update call log", error);
  }
}

export async function markCallPending(callId: string) {
  const context = await getBridgeCallContext(callId);
  const supabase = getSupabaseAdminClient();

  if (!context || !supabase) {
    return;
  }

  await updateCallLog(callId, {
    status: "call_pending",
    outcome: "agent_unavailable",
    ended_at: new Date().toISOString(),
  });

  const { error } = await supabase.from("followups").insert({
    organization_id: context.organizationId,
    lead_id: context.leadId,
    assigned_to: context.agentId,
    due_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    channel: "call",
    notes: "Call back after missed instant bridge call.",
  });

  if (error) {
    console.error("Unable to create missed-call follow-up", error);
  }

  const { data: managers, error: managersError } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", context.organizationId)
    .in("role", ["admin", "sales_manager"]);

  if (managersError) {
    console.error("Unable to load missed-call notification recipients", managersError);
    return;
  }

  if (managers.length) {
    const { error: notificationsError } = await supabase.from("notifications").insert(
      managers.map((manager) => ({
        organization_id: context.organizationId,
        user_id: manager.id,
        notification_type: "missed_lead_call",
        title: "Instant lead call missed",
        body: `${context.leadName} needs a manual follow-up.`,
        metadata: { callId, leadId: context.leadId },
      })),
    );

    if (notificationsError) {
      console.error("Unable to create missed-call notifications", notificationsError);
    }
  }
}

export async function handleAgentUnavailable(callId: string) {
  const context = await getBridgeCallContext(callId);
  const supabase = getSupabaseAdminClient();

  if (!context || !supabase || ["retrying_agent", "call_pending", "completed"].includes(context.status)) {
    return;
  }

  const maxAttempts = Number.parseInt(process.env.TWILIO_MAX_AGENT_ATTEMPTS ?? "2", 10);

  if (context.retryCount >= Math.max(1, maxAttempts) - 1) {
    await markCallPending(callId);
    return;
  }

  const { data: claimedCall, error: claimError } = await supabase
    .from("calls")
    .update({ status: "retrying_agent" })
    .eq("id", callId)
    .eq("status", context.status)
    .select("id")
    .maybeSingle();

  if (claimError || !claimedCall) {
    return;
  }

  const { data: assignedAgents, error: assignmentError } = await supabase.rpc("assign_next_sales_agent", {
    target_organization_id: context.organizationId,
  });
  const nextAgent = assignedAgents?.find((agent: { agent_id: string }) => agent.agent_id !== context.agentId);

  if (assignmentError || !nextAgent?.phone) {
    await markCallPending(callId);
    return;
  }

  try {
    const call = await triggerBridgeCall({
      callId,
      leadId: context.leadId,
      leadName: context.leadName,
      leadPhone: context.leadPhone,
      agentId: nextAgent.agent_id,
      agentPhone: nextAgent.phone,
      source: context.leadSource,
    });

    await updateCallLog(callId, {
      agent_id: nextAgent.agent_id,
      call_sid: call.callSid,
      status: call.status,
      retry_count: context.retryCount + 1,
      started_at: new Date().toISOString(),
    });

    const { error: notificationError } = await supabase.from("notifications").insert({
      organization_id: context.organizationId,
      user_id: nextAgent.agent_id,
      notification_type: "new_lead_assigned",
      title: "Lead reassigned after missed call",
      body: `${context.leadName} from ${context.leadSource}`,
      metadata: { callId, leadId: context.leadId },
    });

    if (notificationError) {
      console.error("Unable to notify reassigned agent", notificationError);
    }
  } catch (error) {
    console.error("Unable to retry bridge call", error);
    await markCallPending(callId);
  }
}
