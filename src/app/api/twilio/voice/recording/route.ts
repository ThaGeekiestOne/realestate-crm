import { NextResponse } from "next/server";
import { readTwilioForm, isValidTwilioRequest } from "@/lib/twilio-request";
import { updateCallLog } from "@/services/call-log-service";

export async function POST(request: Request) {
  const params = await readTwilioForm(request);

  if (!isValidTwilioRequest(request, params)) {
    return NextResponse.json({ error: "Invalid Twilio signature" }, { status: 403 });
  }

  const callId = new URL(request.url).searchParams.get("callId");

  if (!callId) {
    return NextResponse.json({ error: "Missing callId" }, { status: 400 });
  }

  const duration = Number.parseInt(params.RecordingDuration ?? "", 10);
  await updateCallLog(callId, {
    recording_url: params.RecordingUrl,
    ...(Number.isFinite(duration) ? { duration } : {}),
  });

  return NextResponse.json({ received: true });
}
