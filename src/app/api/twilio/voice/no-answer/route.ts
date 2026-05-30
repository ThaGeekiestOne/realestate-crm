import { twiml } from "@/lib/twiml";
import { readTwilioForm, isValidTwilioRequest } from "@/lib/twilio-request";
import { handleAgentUnavailable } from "@/services/call-log-service";

export async function POST(request: Request) {
  const params = await readTwilioForm(request);

  if (!isValidTwilioRequest(request, params)) {
    return new Response("Invalid Twilio signature", { status: 403 });
  }

  const callId = new URL(request.url).searchParams.get("callId");

  if (callId) {
    await handleAgentUnavailable(callId);
  }

  return twiml("<Say>The lead call was not connected. A follow up has been added to your queue.</Say><Hangup/>");
}
