import { traceable } from "langsmith/traceable";
import { generateFollowUpDraft } from "./followup-graph";
import { semanticSearchProperties, type SearchFilters } from "./property-search";

export const tracedSearch = traceable(
  async (query: string, filters: SearchFilters) => semanticSearchProperties(query, filters),
  {
    name: "property_semantic_search",
    run_type: "retriever",
    project_name: process.env.LANGCHAIN_PROJECT ?? "estate-ai-flow",
  },
);

export const tracedFollowUp = traceable(
  async (leadId: string, channel: "whatsapp" | "email") => generateFollowUpDraft(leadId, channel),
  {
    name: "followup_draft_generation",
    run_type: "chain",
    project_name: process.env.LANGCHAIN_PROJECT ?? "estate-ai-flow",
  },
);
