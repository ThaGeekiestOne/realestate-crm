import { afterEach, describe, expect, it, vi } from "vitest";
import { triggerQualificationCall } from "./vapi";

const originalEnv = process.env;

describe("triggerQualificationCall", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("uses dry-run mode unless VAPI_DRY_RUN is explicitly false", async () => {
    process.env = { ...originalEnv, VAPI_DRY_RUN: "true", VAPI_API_KEY: "", VAPI_ASSISTANT_ID: "" };
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await triggerQualificationCall({
      leadId: "lead-1",
      phoneNumber: "+919876543210",
      leadName: "Aarav Mehta",
      organizationName: "EstateFlow",
    });

    expect(result.callId).toMatch(/^dry-run-/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requires Vapi credentials when dry-run is disabled", async () => {
    process.env = { ...originalEnv, VAPI_DRY_RUN: "false", VAPI_API_KEY: "", VAPI_ASSISTANT_ID: "" };

    await expect(triggerQualificationCall({
      leadId: "lead-1",
      phoneNumber: "+919876543210",
      leadName: "Aarav Mehta",
    })).rejects.toThrow("VAPI_API_KEY and VAPI_ASSISTANT_ID are required");
  });
});
