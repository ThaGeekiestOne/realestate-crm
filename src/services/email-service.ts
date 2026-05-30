import "server-only";

import { getOrganizationIntegrationSettings } from "@/services/organization-settings-service";

export interface SendEmailRequest {
  organizationId?: string;
  recipient: string;
  subject: string;
  body: string;
}

export interface SendEmailResult {
  providerMessageId: string;
  status: "simulated" | "queued";
  dryRun: boolean;
}

export async function sendEmail(request: SendEmailRequest): Promise<SendEmailResult> {
  const settings = await getOrganizationIntegrationSettings(request.organizationId);

  if (!request.recipient || !request.subject || !request.body) {
    throw new Error("Email recipient, subject, and body are required");
  }

  if (settings.emailDryRun) {
    return {
      providerMessageId: `dry_email_${Date.now()}`,
      status: "simulated",
      dryRun: true,
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const sender = settings.emailSender;

  if (!apiKey || !sender) {
    throw new Error("Resend email credentials are incomplete");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: sender,
      to: [request.recipient],
      subject: request.subject,
      text: request.body,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Resend email failed with status ${response.status}`);
  }

  const message = await response.json() as { id: string };
  return {
    providerMessageId: message.id,
    status: "queued",
    dryRun: false,
  };
}
