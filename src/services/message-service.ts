import "server-only";

export type MessageChannel = "whatsapp" | "sms";

export interface SendMessageRequest {
  channel: MessageChannel;
  recipient: string;
  body: string;
}

export interface SendMessageResult {
  providerMessageId: string;
  status: "simulated" | "queued";
  dryRun: boolean;
}

export async function sendMessage(request: SendMessageRequest): Promise<SendMessageResult> {
  const dryRun = process.env.MESSAGING_DRY_RUN !== "false";

  if (dryRun) {
    return {
      providerMessageId: `dry_${request.channel}_${Date.now()}`,
      status: "simulated",
      dryRun: true,
    };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const sender = request.channel === "whatsapp" ? process.env.WHATSAPP_SENDER_NUMBER : process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !sender) {
    throw new Error(`Twilio ${request.channel} credentials are incomplete`);
  }

  const body = new URLSearchParams({
    To: request.channel === "whatsapp" ? `whatsapp:${request.recipient}` : request.recipient,
    From: request.channel === "whatsapp" ? `whatsapp:${sender}` : sender,
    Body: request.body,
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Twilio ${request.channel} message failed with status ${response.status}`);
  }

  const message = await response.json() as { sid: string; status?: string };
  return {
    providerMessageId: message.sid,
    status: "queued",
    dryRun: false,
  };
}
