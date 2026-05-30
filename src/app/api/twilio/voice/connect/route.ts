import { conferenceDialTwiml } from "@/lib/twilio-conference";
import { twiml } from "@/lib/twiml";
import { readTwilioForm, isValidTwilioRequest } from "@/lib/twilio-request";
import { callLeadForConference } from "@/services/call-service";
import { getBridgeCallContext, updateCallLog } from "@/services/call-log-service";

export async function POST(request: Request) {
  const params = await readTwilioForm(request);

  if (!isValidTwilioRequest(request, params)) {
    return new Response("Invalid Twilio signature", { status: 403 });
  }

  const callId = new URL(request.url).searchParams.get("callId");

  if (!callId || !params.Digits) {
    return twiml("<Say>We could not confirm the connection request.</Say><Hangup/>");
  }

  const context = await getBridgeCallContext(callId);

  if (!context) {
    return twiml("<Say>Unable to locate this lead call.</Say><Hangup/>");
  }

  try {
    const leadCall = await callLeadForConference({
      callId,
      leadPhone: context.leadPhone,
      organizationId: context.organizationId,
    });

    await updateCallLog(callId, {
      lead_call_sid: leadCall.callSid,
      status: "connecting_lead",
    });
  } catch (error) {
    console.error("Unable to start lead call", error);
    await updateCallLog(callId, {
      status: "failed",
      outcome: "lead_call_failed",
      ended_at: new Date().toISOString(),
    });
    return twiml("<Say>We could not connect the lead. A follow up has been created.</Say><Hangup/>");
  }

  return twiml(`<Say>Connecting your lead now.</Say>${conferenceDialTwiml(callId, true)}`);
}
