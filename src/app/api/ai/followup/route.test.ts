import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/ai/followup", () => {
  it("rejects unauthenticated draft generation", async () => {
    const request = new NextRequest("http://localhost/api/ai/followup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: "11111111-1111-4111-8111-111111111111",
        channel: "whatsapp",
      }),
    });

    const response = await POST(request);
    const body = await response.json() as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("Authentication required");
  });
});
