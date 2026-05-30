"use client";

import type { WorkspaceIdentity } from "@/lib/auth-types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { IntegrationSettings, OrganizationSettingsSnapshot, WorkspaceSettings } from "@/lib/types";

export async function getOrganizationSettings(identity: WorkspaceIdentity) {
  if (identity.isDemo) {
    throw new Error("Demo settings are stored locally.");
  }

  return requestSettingsApi("GET");
}

export async function updateOrganizationWorkspaceSettings(identity: WorkspaceIdentity, workspace: WorkspaceSettings) {
  if (identity.isDemo) {
    throw new Error("Demo settings are stored locally.");
  }

  return requestSettingsApi("PATCH", { workspace });
}

export async function updateOrganizationIntegrationSettings(identity: WorkspaceIdentity, integrations: IntegrationSettings) {
  if (identity.isDemo) {
    throw new Error("Demo settings are stored locally.");
  }

  const persistedSettings = {
    twilioPhone: integrations.twilioPhone,
    whatsappSender: integrations.whatsappSender,
    emailSender: integrations.emailSender,
    socialPublishWebhookUrl: integrations.socialPublishWebhookUrl,
    callDryRun: integrations.callDryRun,
    messagingDryRun: integrations.messagingDryRun,
    emailDryRun: integrations.emailDryRun,
    socialPublishDryRun: integrations.socialPublishDryRun,
  };
  return requestSettingsApi("PATCH", { integrations: persistedSettings });
}

async function requestSettingsApi(method: "GET" | "PATCH", body?: Record<string, unknown>) {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Your session expired. Sign in again.");
  }

  const response = await fetch("/api/settings", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json() as { error?: string; settings?: OrganizationSettingsSnapshot };

  if (!response.ok || !result.settings) {
    throw new Error(result.error ?? "Unable to update organization settings");
  }

  return result.settings;
}
