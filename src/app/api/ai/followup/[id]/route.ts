import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { ProfileRole } from "@/lib/auth-types";
import { canAccessLead } from "@/lib/lead-access";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendEmail } from "@/services/email-service";
import { sendMessage } from "@/services/message-service";

const bodySchema = z.object({
  status: z.enum(["approved", "rejected", "sent"]),
  feedback: z.string().max(500).optional(),
  draftText: z.string().trim().min(1).max(5000).optional(),
});

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface DraftRecord {
  id: string;
  lead_id: string;
  organization_id: string | null;
  channel: "whatsapp" | "email";
  draft_text: string;
  leads: {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    assigned_agent_id: string | null;
  } | {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    assigned_agent_id: string | null;
  }[] | null;
}

function getBearerToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const token = getBearerToken(req);

  if (!supabase || !token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await context.params;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", authData.user.id)
    .single<{ id: string; organization_id: string; role: ProfileRole }>();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Workspace profile not found" }, { status: 403 });
  }

  const { data: draft, error: draftError } = await supabase
    .from("ai_drafts")
    .select("id, lead_id, organization_id, channel, draft_text, leads(id, full_name, phone, email, assigned_agent_id)")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single<DraftRecord>();

  const lead = Array.isArray(draft?.leads) ? draft.leads[0] : draft?.leads;

  if (draftError || !draft || !lead || !canAccessLead(profile.role, profile.id, lead.assigned_agent_id)) {
    return NextResponse.json({ error: "Draft not found or not assigned to you" }, { status: 404 });
  }

  if (parsed.data.status === "sent") {
    const recipient = draft.channel === "email" ? lead.email : lead.phone;
    const body = parsed.data.draftText ?? draft.draft_text;

    if (!recipient) {
      return NextResponse.json({ error: `This lead does not have a ${draft.channel === "email" ? "email address" : "phone number"}` }, { status: 400 });
    }

    try {
      const result = draft.channel === "email"
        ? await sendEmail({
          organizationId: profile.organization_id,
          recipient,
          subject: "Following up on your property search",
          body,
        })
        : await sendMessage({
          organizationId: profile.organization_id,
          channel: "whatsapp",
          recipient,
          body,
        });

      const { error: messageError } = await supabase.from("messages").insert({
        organization_id: profile.organization_id,
        lead_id: lead.id,
        sent_by: profile.id,
        channel: draft.channel,
        provider_message_id: result.providerMessageId,
        recipient,
        body,
        status: result.status,
        sent_at: new Date().toISOString(),
      });
      const { error: activityError } = await supabase.from("activities").insert({
        organization_id: profile.organization_id,
        lead_id: lead.id,
        actor_id: profile.id,
        activity_type: "ai_followup_sent",
        description: `AI follow-up sent via ${draft.channel}`,
        metadata: { draftId: draft.id, dryRun: result.dryRun },
      });

      if (messageError || activityError) {
        console.error("[ai/followup] Audit logging failed", { messageError, activityError });
      }
    } catch (error) {
      console.error("[ai/followup] Dispatch failed", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Draft dispatch failed" }, { status: 502 });
    }
  }

  const { error } = await supabase
    .from("ai_drafts")
    .update({
      status: parsed.data.status,
      draft_text: parsed.data.draftText ?? draft.draft_text,
      feedback: parsed.data.feedback ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
