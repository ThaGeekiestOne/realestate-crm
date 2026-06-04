"use client";

import type { WorkspaceIdentity } from "@/lib/auth-types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Lead, LeadTimelineItem } from "@/lib/types";

export interface LeadUpdateInput {
  status: Lead["status"];
  temperature: Lead["temperature"];
  note: string;
  assignedAgentId?: string;
  agent: string;
}

export async function getLeadTimeline(identity: WorkspaceIdentity, lead: Lead) {
  if (identity.isDemo) {
    return getDemoTimeline(lead);
  }

  return requestLeadApi<LeadTimelineItem[]>(`?leadId=${encodeURIComponent(lead.id)}`, "GET");
}

export async function startLeadBridgeCall(identity: WorkspaceIdentity, lead: Lead) {
  if (identity.isDemo) {
    return { status: "simulated" };
  }

  return requestLeadApi<{ status: string }>("", "POST", {
    action: "call",
    leadId: lead.id,
  });
}

export async function startLeadQualificationCall(identity: WorkspaceIdentity, lead: Lead) {
  if (identity.isDemo) {
    return { callId: `demo-${Date.now()}` };
  }

  return requestAiApi<{ callId: string }>("/api/ai/qualify-lead", {
    leadId: lead.id,
  });
}

export async function updateOrganizationLead(identity: WorkspaceIdentity, lead: Lead, input: LeadUpdateInput) {
  if (identity.isDemo) {
    return {
      ...lead,
      status: input.status,
      temperature: input.temperature,
      note: input.note,
      agent: input.agent,
    };
  }

  return requestLeadApi<Lead>("", "POST", {
    action: "update",
    leadId: lead.id,
    status: input.status,
    temperature: input.temperature,
    notes: input.note,
    assignedAgentId: input.assignedAgentId,
  });
}

async function requestAiApi<T>(path: string, body: Record<string, unknown>) {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Your session expired. Sign in again.");
  }

  const response = await fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const result = await response.json() as { error?: string } & T;

  if (!response.ok) {
    throw new Error(result.error ?? "Unable to start AI action");
  }

  return result;
}

async function requestLeadApi<T>(query: string, method: "GET" | "POST", body?: Record<string, unknown>) {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Your session expired. Sign in again.");
  }

  const response = await fetch(`/api/leads/actions${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json() as { error?: string; lead?: Lead; timeline?: LeadTimelineItem[]; status?: string };

  if (!response.ok) {
    throw new Error(result.error ?? "Unable to update lead");
  }

  if (method === "GET") {
    return result.timeline as T;
  }

  return (result.lead ?? { status: result.status }) as T;
}

function getDemoTimeline(lead: Lead): LeadTimelineItem[] {
  return [
    { id: `${lead.id}-call`, icon: "phone", title: "Bridge call connected", detail: `3m 42s with ${lead.agent}`, timestamp: new Date(Date.now() - 8 * 60_000).toISOString() },
    { id: `${lead.id}-share`, icon: "share", title: "Property details shared", detail: "Emaar Palm Heights via WhatsApp", timestamp: new Date(Date.now() - 19 * 60_000).toISOString() },
    { id: `${lead.id}-created`, icon: "lead", title: "Lead created", detail: `Imported from ${lead.source}`, timestamp: new Date(Date.now() - 24 * 60_000).toISOString() },
  ];
}
