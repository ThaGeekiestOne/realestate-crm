import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";

const originalEnv = process.env;

describe("POST /api/webhooks/voice", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("rejects payloads with an invalid Vapi signature", async () => {
    process.env = { ...originalEnv, VAPI_WEBHOOK_SECRET: "test-secret" };

    const request = new NextRequest("http://localhost/api/webhooks/voice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vapi-signature": "bad-signature",
      },
      body: JSON.stringify({ message: { type: "end-of-call-report" } }),
    });

    const response = await POST(request);
    const body = await response.json() as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("Invalid signature");
  });
});
