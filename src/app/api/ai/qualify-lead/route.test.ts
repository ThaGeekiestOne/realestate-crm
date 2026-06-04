import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/ai/qualify-lead", () => {
  it("rejects unauthenticated qualification calls", async () => {
    const request = new NextRequest("http://localhost/api/ai/qualify-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: "11111111-1111-4111-8111-111111111111" }),
    });

    const response = await POST(request);
    const body = await response.json() as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("Authentication required");
  });
});
