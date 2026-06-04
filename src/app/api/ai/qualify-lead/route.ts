import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { ProfileRole } from "@/lib/auth-types";
import { canAccessLead } from "@/lib/lead-access";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { triggerQualificationCall } from "@/lib/ai/vapi";

const requestSchema = z.object({
  leadId: z.string().uuid(),
});

function getBearerToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdminClient();
  const token = getBearerToken(request);

  if (!supabase || !token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, organization_id, role, organizations(name)")
    .eq("id", authData.user.id)
    .single<{
      id: string;
      organization_id: string;
      role: ProfileRole;
      organizations: { name: string } | { name: string }[] | null;
    }>();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 401 });
  }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, full_name, phone, assigned_agent_id")
    .eq("id", parsed.data.leadId)
    .eq("organization_id", profile.organization_id)
    .single<{ id: string; full_name: string; phone: string; assigned_agent_id: string | null }>();

  if (leadError || !lead || !canAccessLead(profile.role, profile.id, lead.assigned_agent_id)) {
    return NextResponse.json({ error: "Lead not found or not assigned to you" }, { status: 404 });
  }

  try {
    const organization = Array.isArray(profile.organizations) ? profile.organizations[0] : profile.organizations;
    const call = await triggerQualificationCall({
      leadId: lead.id,
      phoneNumber: lead.phone,
      leadName: lead.full_name,
      organizationName: organization?.name,
    });

    const { error: updateError } = await supabase
      .from("leads")
      .update({
        qualification_status: "in_progress",
        qualification_call_id: call.callId,
      })
      .eq("id", lead.id)
      .eq("organization_id", profile.organization_id);

    if (updateError) {
      throw updateError;
    }

    await supabase.from("activities").insert({
      organization_id: profile.organization_id,
      lead_id: lead.id,
      actor_id: profile.id,
      activity_type: "ai_qualification_started",
      description: `AI qualification call started for ${lead.full_name}`,
      metadata: { callId: call.callId, dryRun: process.env.VAPI_DRY_RUN !== "false" },
    });

    return NextResponse.json({ callId: call.callId });
  } catch (error) {
    console.error("[ai/qualify-lead]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Qualification call failed" }, { status: 500 });
  }
}
