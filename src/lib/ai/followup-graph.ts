import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type FollowUpChannel = "whatsapp" | "email";

export interface FollowUpDraftResult {
  draft: string;
  context: string;
}

interface ActivityRecord {
  activity_type?: string | null;
  description?: string | null;
  created_at?: string | null;
}

interface SharedPropertyRecord {
  created_at?: string | null;
  properties?: {
    title?: string | null;
    location?: string | null;
    price?: number | string | null;
  } | null;
}

interface LeadContextRecord {
  id: string;
  full_name?: string | null;
  status?: string | null;
  budget_min?: number | string | null;
  budget_max?: number | string | null;
  preferred_location?: string | null;
  property_type?: string | null;
  notes?: string | null;
  qualified_budget_min?: number | string | null;
  qualified_budget_max?: number | string | null;
  qualified_locations?: string[] | null;
  qualified_timeline?: string | null;
  qualified_property_type?: string | null;
  qualification_sentiment?: string | null;
  activities?: ActivityRecord[] | null;
  lead_property_shares?: SharedPropertyRecord[] | null;
}

const FollowUpAnnotation = Annotation.Root({
  leadId: Annotation<string>(),
  channel: Annotation<FollowUpChannel>(),
  leadContext: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "",
  }),
  draft: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "",
  }),
  critique: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "",
  }),
  approved: Annotation<boolean>({
    reducer: (_left, right) => right,
    default: () => false,
  }),
  retries: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),
});

type FollowUpState = typeof FollowUpAnnotation.State;
type FollowUpUpdate = typeof FollowUpAnnotation.Update;

let llmClient: ChatOpenAI | null = null;

function getLlmClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for follow-up generation");
  }

  if (!llmClient) {
    llmClient = new ChatOpenAI({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      temperature: 0.4,
      apiKey: process.env.OPENAI_API_KEY,
      configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
      },
    });
  }

  return llmClient;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "unknown date";
  }

  return new Date(value).toLocaleDateString("en-IN");
}

function formatPrice(value?: number | string | null) {
  if (value == null || value === "") {
    return "unknown price";
  }

  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return String(value);
  }

  return `INR ${numberValue.toLocaleString("en-IN")}`;
}

function budgetRange(min?: number | string | null, max?: number | string | null) {
  if (min == null && max == null) {
    return "unknown";
  }

  if (min != null && max != null) {
    return `${formatPrice(min)} to ${formatPrice(max)}`;
  }

  if (max != null) {
    return `up to ${formatPrice(max)}`;
  }

  return `from ${formatPrice(min)}`;
}

function messageContentToText(content: unknown) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (typeof part === "object" && part !== null && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }

        return "";
      })
      .join("");
  }

  return "";
}

async function researchNode(state: FollowUpState): Promise<FollowUpUpdate> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase service role client is not configured");
  }

  const { data, error } = await supabase
    .from("leads")
    .select(`
      id,
      full_name,
      status,
      budget_min,
      budget_max,
      preferred_location,
      property_type,
      notes,
      qualified_budget_min,
      qualified_budget_max,
      qualified_locations,
      qualified_timeline,
      qualified_property_type,
      qualification_sentiment,
      activities(activity_type, description, created_at),
      lead_property_shares(created_at, properties(title, location, price))
    `)
    .eq("id", state.leadId)
    .single();

  if (error || !data) {
    throw new Error(`Lead ${state.leadId} not found`);
  }

  const lead = data as LeadContextRecord;
  const activities = (lead.activities ?? [])
    .slice(0, 5)
    .map((activity) => `- ${activity.description ?? activity.activity_type ?? "Activity"} (${formatDate(activity.created_at)})`)
    .join("\n");

  const shares = (lead.lead_property_shares ?? [])
    .map((share) => {
      const property = share.properties;
      if (!property) {
        return null;
      }

      return `- ${property.title ?? "Property"} in ${property.location ?? "unknown location"} at ${formatPrice(property.price)} (shared ${formatDate(share.created_at)})`;
    })
    .filter((share): share is string => Boolean(share))
    .join("\n");

  const context = [
    `Name: ${lead.full_name ?? "Unknown"}`,
    `Stage: ${lead.status ?? "unknown"}`,
    `Budget: ${budgetRange(lead.budget_min, lead.budget_max)}`,
    `Preferred location: ${lead.preferred_location ?? "unknown"}`,
    `Property type: ${lead.property_type ?? "unknown"}`,
    `Qualification: budget ${budgetRange(lead.qualified_budget_min, lead.qualified_budget_max)}, locations ${(lead.qualified_locations ?? []).join(", ") || "unknown"}, timeline ${lead.qualified_timeline ?? "unknown"}, property type ${lead.qualified_property_type ?? "unknown"}, sentiment ${lead.qualification_sentiment ?? "unknown"}`,
    lead.notes ? `Notes:\n- ${lead.notes}` : "",
    activities ? `Recent activity:\n${activities}` : "",
    shares ? `Properties shared:\n${shares}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { leadContext: context };
}

async function writerNode(state: FollowUpState): Promise<FollowUpUpdate> {
  const isWhatsApp = state.channel === "whatsapp";
  const priorCritique = state.critique ? `\nPrior critique to address: ${state.critique}` : "";
  const system = `You are a helpful real estate sales assistant.
Write a personalized follow-up ${isWhatsApp ? "WhatsApp message (max 200 words, conversational)" : "email (max 300 words)"} for a buyer.
- Reference specific properties they were shown if relevant.
- Be warm but professional.
- Do not invent prices, property names, or locations not mentioned in the context.
- End with a clear next step.
- Do not use generic templates.`;
  const human = `Lead context:\n${state.leadContext}${priorCritique}\n\nWrite the follow-up message now.`;
  const response = await getLlmClient().invoke([new SystemMessage(system), new HumanMessage(human)]);

  return {
    draft: messageContentToText(response.content).trim(),
    retries: state.retries + 1,
  };
}

async function criticNode(state: FollowUpState): Promise<FollowUpUpdate> {
  const system = `You are a quality reviewer for real estate follow-up messages.
Check that the message:
1. Does not mention properties, prices, or locations not in the lead context.
2. Has a clear next step.
3. Is appropriately brief for the channel.

Reply with ONLY: "APPROVED" or "REVISE: <one sentence reason>".`;
  const human = `Lead context:\n${state.leadContext}\n\nMessage to review:\n${state.draft}`;
  const response = await getLlmClient().invoke([new SystemMessage(system), new HumanMessage(human)]);
  const output = messageContentToText(response.content).trim();
  const approved = output.startsWith("APPROVED");

  return {
    approved,
    critique: approved ? "" : output.replace(/^REVISE:\s*/i, ""),
  };
}

function shouldRetry(state: FollowUpState): "writer" | typeof END {
  if (!state.approved && state.retries < 3) {
    return "writer";
  }

  return END;
}

export async function generateFollowUpDraft(leadId: string, channel: FollowUpChannel): Promise<FollowUpDraftResult> {
  const graph = new StateGraph(FollowUpAnnotation)
    .addNode("researcher", researchNode)
    .addNode("writer", writerNode)
    .addNode("critic", criticNode)
    .addEdge(START, "researcher")
    .addEdge("researcher", "writer")
    .addEdge("writer", "critic")
    .addConditionalEdges("critic", shouldRetry);
  const compiled = graph.compile();
  const result = await compiled.invoke({ leadId, channel });

  return {
    draft: result.draft,
    context: result.leadContext,
  };
}
