import "server-only";

import { followupTemplates, type FollowupMessageChannel, type FollowupTemplateId } from "@/lib/followup-templates";
import { sendEmail } from "@/services/email-service";
import { sendMessage } from "@/services/message-service";

export interface SendFollowupRequest {
  organizationId?: string;
  channel: FollowupMessageChannel;
  templateId: FollowupTemplateId;
  leadName: string;
  preferredLocation: string;
  recipient: string;
}

export async function sendFollowup(request: SendFollowupRequest) {
  const template = followupTemplates.find((item) => item.id === request.templateId);

  if (!template) {
    throw new Error("Follow-up template not found");
  }

  const body = template.body
    .replaceAll("{{leadName}}", request.leadName)
    .replaceAll("{{preferredLocation}}", request.preferredLocation);

  if (request.channel === "email") {
    const result = await sendEmail({
      organizationId: request.organizationId,
      recipient: request.recipient,
      subject: `Following up on your property search`,
      body,
    });
    return { ...result, body, templateTitle: template.title };
  }

  const result = await sendMessage({
    organizationId: request.organizationId,
    channel: request.channel,
    recipient: request.recipient,
    body,
  });
  return { ...result, body, templateTitle: template.title };
}
