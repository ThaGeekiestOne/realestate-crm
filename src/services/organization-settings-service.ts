import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { IntegrationSettings, IntegrationSecretStatus } from "@/lib/types";

const provider = "provider_adapters";

export type PersistedIntegrationSettings = Omit<IntegrationSettings, "secretStatus">;

export function getEnvironmentSecretStatus(): IntegrationSecretStatus {
  return {
    twilioAccountSid: Boolean(process.env.TWILIO_ACCOUNT_SID),
    twilioAuthToken: Boolean(process.env.TWILIO_AUTH_TOKEN),
    resendApiKey: Boolean(process.env.RESEND_API_KEY),
    webhookSecret: Boolean(process.env.LEAD_WEBHOOK_SECRET),
    openAiApiKey: Boolean(process.env.OPENAI_API_KEY),
  };
}

export function getEnvironmentIntegrationSettings(): PersistedIntegrationSettings {
  return {
    twilioPhone: process.env.TWILIO_PHONE_NUMBER ?? "",
    whatsappSender: process.env.WHATSAPP_SENDER_NUMBER ?? "",
    emailSender: process.env.EMAIL_SENDER ?? "",
    socialPublishWebhookUrl: process.env.SOCIAL_PUBLISH_WEBHOOK_URL ?? "",
    callDryRun: process.env.TWILIO_DRY_RUN !== "false",
    messagingDryRun: process.env.MESSAGING_DRY_RUN !== "false",
    emailDryRun: process.env.EMAIL_DRY_RUN !== "false",
    socialPublishDryRun: process.env.SOCIAL_PUBLISH_DRY_RUN !== "false",
  };
}

export async function getOrganizationIntegrationSettings(organizationId?: string): Promise<PersistedIntegrationSettings> {
  const defaults = getEnvironmentIntegrationSettings();
  const supabase = getSupabaseAdminClient();

  if (!organizationId || !supabase) {
    return defaults;
  }

  const { data, error } = await supabase
    .from("integration_settings")
    .select("settings")
    .eq("organization_id", organizationId)
    .eq("provider", provider)
    .maybeSingle<{ settings: Record<string, unknown> }>();

  if (error) {
    console.error("Unable to load organization integration settings", error);
    return defaults;
  }

  return mergeIntegrationSettings(defaults, data?.settings);
}

export function getIntegrationSettingsProvider() {
  return provider;
}

function mergeIntegrationSettings(defaults: PersistedIntegrationSettings, settings?: Record<string, unknown>) {
  if (!settings) {
    return defaults;
  }

  return {
    twilioPhone: getString(settings.twilioPhone, defaults.twilioPhone),
    whatsappSender: getString(settings.whatsappSender, defaults.whatsappSender),
    emailSender: getString(settings.emailSender, defaults.emailSender),
    socialPublishWebhookUrl: getString(settings.socialPublishWebhookUrl, defaults.socialPublishWebhookUrl),
    callDryRun: getBoolean(settings.callDryRun, defaults.callDryRun),
    messagingDryRun: getBoolean(settings.messagingDryRun, defaults.messagingDryRun),
    emailDryRun: getBoolean(settings.emailDryRun, defaults.emailDryRun),
    socialPublishDryRun: getBoolean(settings.socialPublishDryRun, defaults.socialPublishDryRun),
  };
}

function getString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function getBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}
