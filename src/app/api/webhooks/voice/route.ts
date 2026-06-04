import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

interface QualifyLeadToolCall {
  budget_min?: number;
  budget_max?: number;
  preferred_locations?: string[];
  timeline?: string;
  property_type?: string;
  sentiment?: string;
}

interface VapiWebhookPayload {
  message?: {
    type?: string;
    call?: { id?: string };
    endedReason?: string;
    transcript?: string;
    toolCalls?: Array<{
      function?: {
        name?: string;
        arguments?: string;
      };
    }>;
    metadata?: {
      lead_id?: string;
    };
  };
}

function verifyVapiSignature(req: NextRequest, body: string): boolean {
  const secret = process.env.VAPI_WEBHOOK_SECRET;

  if (!secret) {
    return true;
  }

  const signature = req.headers.get("x-vapi-signature") ?? "";
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer);
}

function parseQualification(args?: string): QualifyLeadToolCall {
  if (!args) {
    return {};
  }

  try {
    const parsed = JSON.parse(args) as unknown;

    if (typeof parsed === "object" && parsed !== null) {
      return parsed as QualifyLeadToolCall;
    }
  } catch {
    return {};
  }

  return {};
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifyVapiSignature(req, rawBody)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: VapiWebhookPayload;

  try {
    payload = JSON.parse(rawBody) as VapiWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = payload.message;

  if (message?.type !== "end-of-call-report") {
    return NextResponse.json({ received: true });
  }

  const leadId = message.metadata?.lead_id;

  if (!leadId) {
    return NextResponse.json({ error: "No lead_id in metadata" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role client is not configured" }, { status: 500 });
  }

  const qualifyCall = message.toolCalls?.find((toolCall) => toolCall.function?.name === "qualify_lead");
  const qualification = parseQualification(qualifyCall?.function?.arguments);
  const status = message.endedReason === "customer-ended-call" || qualifyCall ? "complete" : "failed";
  const { error } = await supabase
    .from("leads")
    .update({
      qualification_status: status,
      qualified_budget_min: qualification.budget_min ?? null,
      qualified_budget_max: qualification.budget_max ?? null,
      qualified_locations: qualification.preferred_locations ?? null,
      qualified_timeline: qualification.timeline ?? null,
      qualified_property_type: qualification.property_type ?? null,
      qualification_sentiment: qualification.sentiment ?? null,
      qualification_call_id: message.call?.id ?? null,
      qualification_transcript: message.transcript ?? null,
      qualification_completed_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (error) {
    console.error("[voice webhook] DB update failed:", error.message);
    return NextResponse.json({ error: "DB update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
