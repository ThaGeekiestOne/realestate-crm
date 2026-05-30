import { conferenceDialTwiml } from "@/lib/twilio-conference";
import { twiml } from "@/lib/twiml";
import { readTwilioForm, isValidTwilioRequest } from "@/lib/twilio-request";
import { getBridgeCallContext, updateCallLog } from "@/services/call-log-service";

export async function POST(request: Request) {
  const params = await readTwilioForm(request);

  if (!isValidTwilioRequest(request, params)) {
    return new Response("Invalid Twilio signature", { status: 403 });
  }

  const callId = new URL(request.url).searchParams.get("callId");

  if (!callId || !await getBridgeCallContext(callId)) {
    return twiml("<Say>Unable to locate this call.</Say><Hangup/>");
  }

  await updateCallLog(callId, { status: "lead_answered" });
  return twiml(`<Say>Please hold while we connect you with your property advisor.</Say>${conferenceDialTwiml(callId, false)}`);
}
