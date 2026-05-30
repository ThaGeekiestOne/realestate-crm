import { NextResponse } from "next/server";
import { readTwilioForm, isValidTwilioRequest } from "@/lib/twilio-request";
import { handleAgentUnavailable, updateCallLog } from "@/services/call-log-service";

const pendingStatuses = new Set(["busy", "failed", "no-answer", "canceled"]);

export async function POST(request: Request) {
  const params = await readTwilioForm(request);

  if (!isValidTwilioRequest(request, params)) {
    return NextResponse.json({ error: "Invalid Twilio signature" }, { status: 403 });
  }

  const url = new URL(request.url);
  const callId = url.searchParams.get("callId");
  const leg = url.searchParams.get("leg") === "lead" ? "lead" : "agent";
  const callStatus = params.CallStatus ?? "unknown";

  if (!callId) {
    return NextResponse.json({ error: "Missing callId" }, { status: 400 });
  }

  if (leg === "agent" && pendingStatuses.has(callStatus)) {
    await handleAgentUnavailable(callId);
  } else {
    const duration = Number.parseInt(params.CallDuration ?? "", 10);
    await updateCallLog(callId, {
      status: leg === "lead" && callStatus === "in-progress" ? "connected" : `${leg}_${callStatus}`,
      ...(Number.isFinite(duration) ? { duration } : {}),
      ...(callStatus === "completed" ? { ended_at: new Date().toISOString() } : {}),
    });
  }

  return NextResponse.json({ received: true });
}
