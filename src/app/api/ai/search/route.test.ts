import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/ai/search", () => {
  it("rejects unauthenticated requests before using service-role search", async () => {
    const request = new NextRequest("http://localhost/api/ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "3BHK apartment", matchCount: 5 }),
    });

    const response = await POST(request);
    const body = await response.json() as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("Authentication required");
  });
});
