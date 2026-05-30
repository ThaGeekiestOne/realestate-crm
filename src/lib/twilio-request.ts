import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getPublicAppUrl } from "@/services/call-service";

export async function readTwilioForm(request: Request) {
  const formData = await request.formData();
  return Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value)]));
}

export function isValidTwilioRequest(request: Request, params: Record<string, string>) {
  if (process.env.TWILIO_VALIDATE_SIGNATURES === "false") {
    return true;
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = request.headers.get("x-twilio-signature");

  if (!authToken || !signature) {
    return false;
  }

  const requestUrl = new URL(request.url);
  const publicUrl = `${getPublicAppUrl()}${requestUrl.pathname}${requestUrl.search}`;
  const payload = Object.keys(params)
    .sort()
    .reduce((value, key) => `${value}${key}${params[key]}`, publicUrl);
  const expected = createHmac("sha1", authToken).update(payload).digest("base64");
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}
