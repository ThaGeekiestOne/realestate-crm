"use client";

import type { WorkspaceIdentity } from "@/lib/auth-types";
import type { FollowupMessageChannel, FollowupTemplateId } from "@/lib/followup-templates";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Followup } from "@/lib/types";

interface FollowupActionResponse {
  dueAt?: string;
  followup?: Followup;
  status?: string;
  error?: string;
}

export async function scheduleLeadFollowup(identity: WorkspaceIdentity, followup: Followup) {
  if (identity.isDemo) {
    return followup;
  }

  const result = await postFollowupAction({
    action: "schedule",
    leadId: followup.leadId,
    purpose: followup.purpose,
    dueAt: parseFollowupTime(followup.time),
    channel: normalizeChannel(followup.channel),
  });

  if (!result.followup) {
    throw new Error("Unable to schedule follow-up");
  }

  return result.followup;
}

export async function completeLeadFollowup(identity: WorkspaceIdentity, followupId: string) {
  if (identity.isDemo) {
    return { status: "simulated" };
  }

  return postFollowupAction({ action: "complete", followupId });
}

export async function sendLeadFollowup(
  identity: WorkspaceIdentity,
  followupId: string,
  channel: FollowupMessageChannel,
  templateId: FollowupTemplateId,
) {
  if (identity.isDemo) {
    return { status: "simulated" };
  }

  return postFollowupAction({
    action: "send",
    followupId,
    channel,
    templateId,
  });
}

export async function snoozeLeadFollowup(identity: WorkspaceIdentity, followupId: string, minutes = 30) {
  if (identity.isDemo) {
    return { dueAt: new Date(Date.now() + minutes * 60_000).toISOString() };
  }

  return postFollowupAction({
    action: "snooze",
    followupId,
    minutes,
  });
}

async function postFollowupAction(body: Record<string, unknown>) {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Your session expired. Sign in again.");
  }

  const response = await fetch("/api/followups/actions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const result = await response.json() as FollowupActionResponse;

  if (!response.ok) {
    throw new Error(result.error ?? "Unable to update follow-up");
  }

  return result;
}

function normalizeChannel(channel: Followup["channel"]) {
  if (channel === "WhatsApp") return "whatsapp";
  if (channel === "SMS") return "sms";
  if (channel === "Email") return "email";
  if (channel === "Site visit") return "site_visit";
  return "call";
}

function parseFollowupTime(value: string) {
  const normalized = value.trim();
  const relativeMatch = normalized.match(/^(today|tomorrow),?\s+(.+)$/i);

  if (relativeMatch) {
    const date = new Date();
    if (relativeMatch[1].toLowerCase() === "tomorrow") {
      date.setDate(date.getDate() + 1);
    }

    const time = relativeMatch[2].match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
    if (time) {
      let hours = Number(time[1]) % 12;
      if (time[3].toLowerCase() === "pm") {
        hours += 12;
      }

      date.setHours(hours, Number(time[2] ?? 0), 0, 0);
      return date.toISOString();
    }
  }

  const timestamp = Date.parse(normalized);
  if (Number.isNaN(timestamp)) {
    throw new Error("Enter a follow-up time such as Tomorrow, 11:00 AM.");
  }

  return new Date(timestamp).toISOString();
}
