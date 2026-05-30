export type FollowupMessageChannel = "whatsapp" | "sms" | "email";

export const followupTemplates = [
  {
    id: "review-property",
    title: "Review property",
    body: "Hi {{leadName}}, just checking if you had a chance to review the property details I shared.",
  },
  {
    id: "quick-call",
    title: "Quick call",
    body: "Hi {{leadName}}, are you available for a quick call today to discuss properties in {{preferredLocation}}?",
  },
  {
    id: "new-options",
    title: "New matches",
    body: "Hi {{leadName}}, we have a few new options matching your budget. Should I share them?",
  },
] as const;

export type FollowupTemplateId = typeof followupTemplates[number]["id"];
