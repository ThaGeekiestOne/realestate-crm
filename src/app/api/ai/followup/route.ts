import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { ProfileRole } from "@/lib/auth-types";
import { tracedFollowUp } from "@/lib/ai/tracing";
import { canAccessLead } from "@/lib/lead-access";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const requestSchema = z.object({
  leadId: z.string().uuid(),
  channel: z.enum(["whatsapp", "email"]),
  organizationId: z.string().uuid().optional(),
});

function getBearerToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
}

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);

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

  try {
    const { leadId, channel } = parsed.data;
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, organization_id, role")
      .eq("id", authData.user.id)
      .single<{ id: string; organization_id: string; role: ProfileRole }>();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Workspace profile not found" }, { status: 403 });
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, assigned_agent_id")
      .eq("id", leadId)
      .eq("organization_id", profile.organization_id)
      .single<{ id: string; assigned_agent_id: string | null }>();

    if (leadError || !lead || !canAccessLead(profile.role, profile.id, lead.assigned_agent_id)) {
      return NextResponse.json({ error: "Lead not found or not assigned to you" }, { status: 404 });
    }

    const { draft, context } = await tracedFollowUp(leadId, channel);
    const { data: record, error } = await supabase
      .from("ai_drafts")
      .insert({
        lead_id: leadId,
        organization_id: profile.organization_id,
        channel,
        draft_text: draft,
        context_summary: context.slice(0, 1000),
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ draftId: record.id, draft, channel });
  } catch (error) {
    console.error("[ai/followup]", error);
    return NextResponse.json({ error: "Draft generation failed" }, { status: 500 });
  }
}
