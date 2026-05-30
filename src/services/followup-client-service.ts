"use client";

import type { WorkspaceIdentity } from "@/lib/auth-types";
import type { FollowupMessageChannel, FollowupTemplateId } from "@/lib/followup-templates";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

interface FollowupActionResponse {
  dueAt?: string;
  status?: string;
  error?: string;
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
