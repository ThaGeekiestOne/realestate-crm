import "server-only";

import { getOrganizationIntegrationSettings } from "@/services/organization-settings-service";

export interface BridgeCallRequest {
  organizationId?: string;
  callId?: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  agentId: string;
  agentPhone: string;
  source: string;
}

export interface BridgeCallResult {
  callSid: string;
  status: "simulated" | "queued";
  dryRun: boolean;
}

interface TwilioCallResponse {
  sid: string;
}

export function getPublicAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function getProductionCallbackBaseUrl() {
  const appUrl = getPublicAppUrl();

  if (!process.env.NEXT_PUBLIC_APP_URL || /^https?:\/\/(localhost|127\.0\.0\.1)(?::|\/|$)/i.test(appUrl)) {
    throw new Error("NEXT_PUBLIC_APP_URL must be a publicly reachable URL before production Twilio calls are enabled");
  }

  return appUrl;
}

function getTwilioCredentials(phoneNumber: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken || !phoneNumber) {
    throw new Error("Twilio credentials are incomplete");
  }

  return { accountSid, authToken, phoneNumber };
}

async function createTwilioCall(input: {
  to: string;
  voiceUrl: string;
  statusCallbackUrl: string;
  phoneNumber: string;
}) {
  const { accountSid, authToken, phoneNumber } = getTwilioCredentials(input.phoneNumber);
  const body = new URLSearchParams({
    To: input.to,
    From: phoneNumber,
    Url: input.voiceUrl,
    Method: "POST",
    StatusCallback: input.statusCallbackUrl,
    StatusCallbackMethod: "POST",
    StatusCallbackEvent: "initiated ringing answered completed",
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Twilio call creation failed with status ${response.status}`);
  }

  return response.json() as Promise<TwilioCallResponse>;
}

export async function triggerBridgeCall(request: BridgeCallRequest): Promise<BridgeCallResult> {
  const settings = await getOrganizationIntegrationSettings(request.organizationId);

  if (settings.callDryRun) {
    return {
      callSid: `dry_${request.leadId}_${Date.now()}`,
      status: "simulated",
      dryRun: true,
    };
  }

  if (!request.callId) {
    throw new Error("A persisted call ID is required for production bridge calls");
  }

  if (!request.agentPhone) {
    throw new Error("The assigned agent does not have a phone number");
  }

  const appUrl = getProductionCallbackBaseUrl();
  const call = await createTwilioCall({
    to: request.agentPhone,
    voiceUrl: `${appUrl}/api/twilio/voice/agent?callId=${encodeURIComponent(request.callId)}`,
    statusCallbackUrl: `${appUrl}/api/twilio/voice/status?callId=${encodeURIComponent(request.callId)}&leg=agent`,
    phoneNumber: settings.twilioPhone,
  });

  return {
    callSid: call.sid,
    status: "queued",
    dryRun: false,
  };
}

export async function callLeadForConference(input: { callId: string; leadPhone: string; organizationId?: string }) {
  const settings = await getOrganizationIntegrationSettings(input.organizationId);

  if (settings.callDryRun) {
    return { callSid: `dry_lead_${input.callId}_${Date.now()}` };
  }

  const appUrl = getProductionCallbackBaseUrl();
  const call = await createTwilioCall({
    to: input.leadPhone,
    voiceUrl: `${appUrl}/api/twilio/voice/lead?callId=${encodeURIComponent(input.callId)}`,
    statusCallbackUrl: `${appUrl}/api/twilio/voice/status?callId=${encodeURIComponent(input.callId)}&leg=lead`,
    phoneNumber: settings.twilioPhone,
  });

  return { callSid: call.sid };
}
