import "server-only";

export interface PublishSocialPostRequest {
  postId: string;
  postType: string;
  title: string;
  caption: string;
  mediaUrls: string[];
  scheduledAt?: string | null;
  webhookUrl?: string;
}

export interface PublishSocialPostResult {
  status: "simulated" | "queued";
  dryRun: boolean;
}

export async function publishSocialPost(request: PublishSocialPostRequest): Promise<PublishSocialPostResult> {
  const dryRun = process.env.SOCIAL_PUBLISH_DRY_RUN !== "false";

  if (dryRun || !request.webhookUrl) {
    return { status: "simulated", dryRun: true };
  }

  const response = await fetch(request.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Social publishing webhook failed with status ${response.status}`);
  }

  return { status: "queued", dryRun: false };
}

export async function draftSocialCaption({ title, postType }: { title: string; postType: string }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  if (!apiKey) {
    return `Discover ${title}. Save this ${postType.toLowerCase()} for the latest property details, location highlights, and site-visit updates.`;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Write concise professional real-estate social captions. Return only the caption." },
        { role: "user", content: `Create a caption for a ${postType} titled "${title}".` },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`AI caption request failed with status ${response.status}`);
  }

  const result = await response.json() as { choices?: { message?: { content?: string } }[] };
  return result.choices?.[0]?.message?.content?.trim() || `Discover ${title}. Contact us for details.`;
}
