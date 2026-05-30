import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { LeadAssignmentMode, OrganizationSettingsSnapshot } from "@/lib/types";
import {
  getEnvironmentSecretStatus,
  getIntegrationSettingsProvider,
  getOrganizationIntegrationSettings,
  type PersistedIntegrationSettings,
} from "@/services/organization-settings-service";

const assignmentModes = ["round_robin", "manual", "least_busy"] as const;
const integrationsSchema = z.object({
  twilioPhone: z.string().trim().max(30),
  whatsappSender: z.string().trim().max(30),
  emailSender: z.string().trim().max(254),
  socialPublishWebhookUrl: z.union([z.literal(""), z.string().trim().url().max(500)]),
  callDryRun: z.boolean(),
  messagingDryRun: z.boolean(),
  emailDryRun: z.boolean(),
  socialPublishDryRun: z.boolean(),
});
const updateSchema = z.object({
  workspace: z.object({
    organizationName: z.string().trim().min(2).max(120),
    assignmentMode: z.enum(assignmentModes),
  }).optional(),
  integrations: integrationsSchema.optional(),
}).refine((value) => value.workspace || value.integrations, "At least one settings section is required");

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
    .single<{ id: string; organization_id: string; role: string }>();

  return profileError || !profile ? null : { supabase, profile };
}

export async function GET(request: Request) {
  const context = await getRequestContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    return NextResponse.json({ settings: await getSettingsSnapshot(context.supabase, context.profile.organization_id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load settings" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const context = await getRequestContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (context.profile.role !== "admin") {
    return NextResponse.json({ error: "Only organization admins can update settings" }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(await readJson(request));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid organization settings", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.workspace) {
    const { error } = await context.supabase
      .from("organizations")
      .update({
        name: parsed.data.workspace.organizationName,
        lead_assignment_mode: parsed.data.workspace.assignmentMode,
      })
      .eq("id", context.profile.organization_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (parsed.data.integrations) {
    const { error } = await context.supabase.from("integration_settings").upsert({
      organization_id: context.profile.organization_id,
      provider: getIntegrationSettingsProvider(),
      settings: parsed.data.integrations,
      is_enabled: true,
    }, { onConflict: "organization_id,provider" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ settings: await getSettingsSnapshot(context.supabase, context.profile.organization_id) });
}

async function getSettingsSnapshot(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  organizationId: string,
): Promise<OrganizationSettingsSnapshot> {
  const [{ data: organization, error }, integrations] = await Promise.all([
    supabase
      .from("organizations")
      .select("name, lead_assignment_mode")
      .eq("id", organizationId)
      .single<{ name: string; lead_assignment_mode: LeadAssignmentMode }>(),
    getOrganizationIntegrationSettings(organizationId),
  ]);

  if (error || !organization) {
    throw new Error(error?.message ?? "Organization settings could not be loaded");
  }

  return {
    workspace: {
      organizationName: organization.name,
      assignmentMode: organization.lead_assignment_mode,
    },
    integrations: {
      ...(integrations as PersistedIntegrationSettings),
      secretStatus: getEnvironmentSecretStatus(),
    },
  };
}

async function readJson(request: Request) {
  try {
    return await request.json() as unknown;
  } catch {
    return null;
  }
}
