import { NextResponse } from "next/server";
import { z } from "zod";
import type { ProfileRole } from "@/lib/auth-types";
import { canAccessLead } from "@/lib/lead-access";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { followupTemplates } from "@/lib/followup-templates";
import { sendFollowup } from "@/services/followup-service";

const sendSchema = z.object({
  action: z.literal("send"),
  followupId: z.string().uuid(),
  channel: z.enum(["whatsapp", "sms", "email"]),
  templateId: z.enum(followupTemplates.map((template) => template.id) as [
    typeof followupTemplates[number]["id"],
    ...typeof followupTemplates[number]["id"][],
  ]),
});

const snoozeSchema = z.object({
  action: z.literal("snooze"),
  followupId: z.string().uuid(),
  minutes: z.number().int().min(15).max(1440),
});

const actionSchema = z.discriminatedUnion("action", [sendSchema, snoozeSchema]);

function getBearerToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdminClient();
  const token = getBearerToken(request);

  if (!supabase || !token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData.user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid follow-up action", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", authData.user.id)
    .single<{ id: string; organization_id: string; role: ProfileRole }>();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Workspace profile not found" }, { status: 403 });
  }

  const { data: followup, error: followupError } = await supabase
    .from("followups")
    .select("id, lead_id, leads!inner(id, full_name, phone, email, preferred_location, assigned_agent_id)")
    .eq("id", parsed.data.followupId)
    .eq("organization_id", profile.organization_id)
    .is("completed_at", null)
    .single();

  if (followupError || !followup) {
    return NextResponse.json({ error: "Pending follow-up not found in your organization" }, { status: 404 });
  }

  const lead = Array.isArray(followup.leads) ? followup.leads[0] : followup.leads;

  if (!canAccessLead(profile.role, profile.id, lead.assigned_agent_id)) {
    return NextResponse.json({ error: "Follow-up not found or not assigned to you" }, { status: 404 });
  }

  if (parsed.data.action === "snooze") {
    const dueAt = new Date(Date.now() + parsed.data.minutes * 60_000).toISOString();
    const { error } = await supabase
      .from("followups")
      .update({ due_at: dueAt })
      .eq("id", followup.id)
      .eq("organization_id", profile.organization_id);

    if (error) {
      return NextResponse.json({ error: "Unable to snooze follow-up" }, { status: 500 });
    }

    await supabase.from("activities").insert({
      organization_id: profile.organization_id,
      lead_id: lead.id,
      actor_id: profile.id,
      activity_type: "followup_snoozed",
      description: `Follow-up snoozed for ${parsed.data.minutes} minutes`,
      metadata: { followupId: followup.id, dueAt },
    });

    return NextResponse.json({ dueAt });
  }

  const recipient = parsed.data.channel === "email" ? lead.email : lead.phone;

  if (!recipient) {
    return NextResponse.json({ error: `This lead does not have a ${parsed.data.channel === "email" ? "email address" : "phone number"}` }, { status: 400 });
  }

  try {
    const result = await sendFollowup({
      channel: parsed.data.channel,
      templateId: parsed.data.templateId,
      leadName: lead.full_name,
      preferredLocation: lead.preferred_location ?? "your preferred location",
      recipient,
    });

    const { error: messageError } = await supabase.from("messages").insert({
      organization_id: profile.organization_id,
      lead_id: lead.id,
      sent_by: profile.id,
      channel: parsed.data.channel,
      provider_message_id: result.providerMessageId,
      recipient,
      body: result.body,
      status: result.status,
      sent_at: new Date().toISOString(),
    });
    const { error: activityError } = await supabase.from("activities").insert({
      organization_id: profile.organization_id,
      lead_id: lead.id,
      actor_id: profile.id,
      activity_type: "followup_sent",
      description: `${result.templateTitle} follow-up sent via ${parsed.data.channel}`,
      metadata: { followupId: followup.id, templateId: parsed.data.templateId },
    });

    if (messageError || activityError) {
      console.error("Follow-up audit logging failed", { messageError, activityError });
    }

    return NextResponse.json({ status: result.status });
  } catch (error) {
    console.error("Follow-up dispatch failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Follow-up dispatch failed" }, { status: 502 });
  }
}
