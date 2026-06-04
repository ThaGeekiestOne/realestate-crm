export interface QualifyLeadParams {
  leadId: string;
  phoneNumber: string;
  leadName: string;
  organizationName?: string;
}

export interface VapiCallResponse {
  callId: string;
}

const VAPI_BASE = "https://api.vapi.ai";

export async function triggerQualificationCall(params: QualifyLeadParams): Promise<VapiCallResponse> {
  if (process.env.VAPI_DRY_RUN !== "false") {
    console.log("[Vapi DRY RUN] Would call:", params);
    return { callId: `dry-run-${Date.now()}` };
  }

  if (!process.env.VAPI_API_KEY || !process.env.VAPI_ASSISTANT_ID) {
    throw new Error("VAPI_API_KEY and VAPI_ASSISTANT_ID are required when VAPI_DRY_RUN=false");
  }

  const response = await fetch(`${VAPI_BASE}/call/phone`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assistantId: process.env.VAPI_ASSISTANT_ID,
      customer: {
        number: params.phoneNumber,
        name: params.leadName,
      },
      assistantOverrides: {
        variableValues: {
          lead_id: params.leadId,
          organization_name: params.organizationName ?? "our team",
        },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Vapi call failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { id?: unknown };

  if (typeof data.id !== "string") {
    throw new Error("Vapi response did not include a call id");
  }

  return { callId: data.id };
}
