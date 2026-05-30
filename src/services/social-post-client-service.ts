"use client";

import type { WorkspaceIdentity } from "@/lib/auth-types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { SocialPost } from "@/lib/types";

export async function getOrganizationSocialPosts(identity: WorkspaceIdentity) {
  if (identity.isDemo) {
    throw new Error("Demo social posts are stored locally.");
  }

  if (!["admin", "social_media_manager"].includes(identity.role)) {
    return { posts: [] };
  }

  return requestSocialApi<{ posts: SocialPost[] }>("GET");
}

export async function createOrganizationSocialPost(identity: WorkspaceIdentity, post: SocialPost, files: File[] = []) {
  const mediaStoragePaths = await uploadSocialMedia(identity, files);
  return requestSocialApi<{ post: SocialPost }>("POST", {
    title: post.title,
    postType: post.type,
    caption: post.caption,
    scheduledAt: parseScheduledAt(post.scheduledFor),
    notes: post.notes ?? "",
    mediaStoragePaths,
  });
}

export async function publishOrganizationSocialPost(identity: WorkspaceIdentity, postId: string) {
  void identity;
  return requestSocialApi<{ post: SocialPost; dispatchStatus: string }>("PATCH", { postId, action: "publish" });
}

export async function draftOrganizationSocialCaption(identity: WorkspaceIdentity, postId: string) {
  void identity;
  return requestSocialApi<{ post: SocialPost }>("PATCH", { postId, action: "draft-caption" });
}

export function draftDemoSocialCaption(post: SocialPost) {
  return `Discover ${post.title}. Save this ${post.type.toLowerCase()} for the latest property details, location highlights, and site-visit updates.`;
}

async function uploadSocialMedia(identity: WorkspaceIdentity, files: File[]) {
  if (identity.isDemo || !files.length) {
    return [];
  }

  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase browser client is not configured");
  }

  const paths: string[] = [];

  for (const file of files) {
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${identity.organizationId}/${identity.id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("social-media").upload(path, file, { contentType: file.type, upsert: false });

    if (error) {
      throw new Error(error.message);
    }

    paths.push(path);
  }

  return paths;
}

async function requestSocialApi<T>(method: "GET" | "POST" | "PATCH", body?: Record<string, unknown>) {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Your session expired. Sign in again.");
  }

  const response = await fetch("/api/social-posts", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json() as T & { error?: string };

  if (!response.ok) {
    throw new Error(result.error ?? "Unable to update social post");
  }

  return result;
}

function parseScheduledAt(value: string) {
  if (!value || value === "Not scheduled") {
    return null;
  }

  const relativeMatch = value.trim().match(/^(today|tomorrow),?\s+(.+)$/i);

  if (relativeMatch) {
    const date = new Date();
    if (relativeMatch[1].toLowerCase() === "tomorrow") {
      date.setDate(date.getDate() + 1);
    }

    const time = relativeMatch[2].match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
    if (time) {
      let hours = Number(time[1]) % 12;
      if (time[3].toLowerCase() === "pm") {
        hours += 12;
      }

      date.setHours(hours, Number(time[2] ?? 0), 0, 0);
      return date.toISOString();
    }
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}
