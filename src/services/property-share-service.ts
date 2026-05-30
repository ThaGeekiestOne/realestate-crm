import "server-only";

import { sendEmail } from "@/services/email-service";
import { sendMessage, type MessageChannel } from "@/services/message-service";

export interface SharePropertyRequest {
  channel: MessageChannel | "email";
  leadName: string;
  recipient: string;
  propertyTitle: string;
  location: string;
  price: string;
  publicToken: string;
}

export async function shareProperty(request: SharePropertyRequest) {
  const shareUrl = new URL(`/share/properties/${request.publicToken}`, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").toString();
  const body = `Hi ${request.leadName}, sharing details of ${request.propertyTitle} in ${request.location}. Price: ${request.price}. Photos and details: ${shareUrl}`;

  if (request.channel === "email") {
    const result = await sendEmail({
      recipient: request.recipient,
      subject: `${request.propertyTitle} property details`,
      body,
    });
    return { ...result, shareUrl, body };
  }

  const result = await sendMessage({
    channel: request.channel,
    recipient: request.recipient,
    body,
  });
  return { ...result, shareUrl, body };
}
