import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { PATCH } from "./route";

describe("PATCH /api/ai/followup/[id]", () => {
  it("rejects unauthenticated draft feedback", async () => {
    const request = new NextRequest("http://localhost/api/ai/followup/11111111-1111-4111-8111-111111111111", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    });
    const body = await response.json() as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("Authentication required");
  });
});
