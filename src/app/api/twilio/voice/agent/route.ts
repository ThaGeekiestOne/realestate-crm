import { escapeXml, twiml } from "@/lib/twiml";
import { readTwilioForm, isValidTwilioRequest } from "@/lib/twilio-request";
import { getPublicAppUrl } from "@/services/call-service";
import { getBridgeCallContext, updateCallLog } from "@/services/call-log-service";

export async function POST(request: Request) {
  const params = await readTwilioForm(request);

  if (!isValidTwilioRequest(request, params)) {
    return new Response("Invalid Twilio signature", { status: 403 });
  }

  const callId = new URL(request.url).searchParams.get("callId");

  if (!callId) {
    return twiml("<Say>Unable to locate this lead call.</Say><Hangup/>");
  }

  const context = await getBridgeCallContext(callId);

  if (!context) {
    return twiml("<Say>Unable to locate this lead call.</Say><Hangup/>");
  }

  await updateCallLog(callId, {
    status: "agent_answered",
    started_at: new Date().toISOString(),
  });

  const appUrl = getPublicAppUrl();
  const connectUrl = `${appUrl}/api/twilio/voice/connect?callId=${encodeURIComponent(callId)}`;
  const noAnswerUrl = `${appUrl}/api/twilio/voice/no-answer?callId=${encodeURIComponent(callId)}`;

  return twiml(
    `<Gather action="${escapeXml(connectUrl)}" method="POST" numDigits="1" timeout="8"><Say>New real estate lead from ${escapeXml(context.leadSource)}. Press any key to connect with ${escapeXml(context.leadName)}.</Say></Gather><Redirect method="POST">${escapeXml(noAnswerUrl)}</Redirect>`,
  );
}
