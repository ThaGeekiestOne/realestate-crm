import { NextResponse } from "next/server";
import { z } from "zod";
import type { ProfileRole } from "@/lib/auth-types";
import { canAccessLead } from "@/lib/lead-access";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { shareProperty } from "@/services/property-share-service";

const shareSchema = z.object({
  leadId: z.string().uuid(),
  propertyId: z.string().uuid(),
  channel: z.enum(["whatsapp", "sms", "email"]),
});

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

  const parsed = shareSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid property share request", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", authData.user.id)
    .single<{ id: string; organization_id: string; role: ProfileRole }>();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Workspace profile not found" }, { status: 403 });
  }

  const [{ data: lead, error: leadError }, { data: property, error: propertyError }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, full_name, phone, email, assigned_agent_id")
      .eq("id", parsed.data.leadId)
      .eq("organization_id", profile.organization_id)
      .single(),
    supabase
      .from("properties")
      .select("id, title, location, price")
      .eq("id", parsed.data.propertyId)
      .eq("organization_id", profile.organization_id)
      .single(),
  ]);

  if (leadError || !lead || propertyError || !property) {
    return NextResponse.json({ error: "Lead or property not found in your organization" }, { status: 404 });
  }

  if (!canAccessLead(profile.role, profile.id, lead.assigned_agent_id)) {
    return NextResponse.json({ error: "Lead not found or not assigned to you" }, { status: 404 });
  }

  const recipient = parsed.data.channel === "email" ? lead.email : lead.phone;

  if (!recipient) {
    return NextResponse.json({ error: `This lead does not have a ${parsed.data.channel === "email" ? "email address" : "phone number"}` }, { status: 400 });
  }

  const { data: share, error: shareError } = await supabase
    .from("lead_property_shares")
    .insert({
      organization_id: profile.organization_id,
      lead_id: lead.id,
      property_id: property.id,
      shared_by: profile.id,
      channel: parsed.data.channel,
    })
    .select("id, public_token")
    .single();

  if (shareError) {
    console.error("Unable to create property share", shareError);
    return NextResponse.json({ error: "Unable to create property share" }, { status: 500 });
  }

  try {
    const result = await shareProperty({
      organizationId: profile.organization_id,
      channel: parsed.data.channel,
      leadName: lead.full_name,
      recipient,
      propertyTitle: property.title,
      location: property.location,
      price: formatCurrency(property.price),
      publicToken: share.public_token,
    });

    const { error: auditError } = await supabase.from("messages").insert({
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
      activity_type: "property_shared",
      description: `${property.title} shared via ${parsed.data.channel}`,
      metadata: { propertyId: property.id, shareId: share.id, shareUrl: result.shareUrl },
    });
    const { error: notificationError } = await supabase.from("notifications").insert({
      organization_id: profile.organization_id,
      user_id: lead.assigned_agent_id ?? profile.id,
      notification_type: "property_shared",
      title: "Property details shared",
      body: `${property.title} was shared with ${lead.full_name} via ${parsed.data.channel}.`,
      metadata: { leadId: lead.id, propertyId: property.id, shareId: share.id },
    });

    if (auditError || activityError || notificationError) {
      console.error("Property share audit logging failed", { auditError, activityError, notificationError });
    }

    return NextResponse.json({ shareId: share.id, shareUrl: result.shareUrl, status: result.status }, { status: 201 });
  } catch (error) {
    console.error("Property share dispatch failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Property share dispatch failed" }, { status: 502 });
  }
}

function formatCurrency(value: number | null) {
  if (!value) {
    return "Price on request";
  }

  return value >= 10000000
    ? `₹${(value / 10000000).toFixed(2).replace(/\.?0+$/, "")} Cr`
    : `₹${(value / 100000).toFixed(0)} L`;
}
