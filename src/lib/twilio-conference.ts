import { escapeXml } from "@/lib/twiml";
import { getPublicAppUrl } from "@/services/call-service";

export function getConferenceName(callId: string) {
  return `estateflow-${callId}`;
}

export function conferenceDialTwiml(callId: string, endConferenceOnExit: boolean) {
  const appUrl = getPublicAppUrl();
  return `<Dial><Conference startConferenceOnEnter="true" endConferenceOnExit="${endConferenceOnExit}" record="record-from-start" recordingStatusCallback="${escapeXml(`${appUrl}/api/twilio/voice/recording?callId=${encodeURIComponent(callId)}`)}" recordingStatusCallbackMethod="POST" statusCallback="${escapeXml(`${appUrl}/api/twilio/voice/conference?callId=${encodeURIComponent(callId)}`)}" statusCallbackMethod="POST" statusCallbackEvent="start end join leave">${escapeXml(getConferenceName(callId))}</Conference></Dial>`;
}
