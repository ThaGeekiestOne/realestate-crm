import { NextResponse } from "next/server";
import { z } from "zod";
import type { ProfileRole } from "@/lib/auth-types";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { draftSocialCaption, publishSocialPost } from "@/services/social-post-service";

const postTypes = ["Instagram Reel", "Instagram Post", "Facebook Post", "LinkedIn Post", "Story"] as const;

const createSchema = z.object({
  title: z.string().trim().min(1).max(160),
  postType: z.enum(postTypes),
  caption: z.string().trim().max(3000).default(""),
  scheduledAt: z.string().datetime().nullable().optional(),
  notes: z.string().trim().max(1000).default(""),
  mediaStoragePaths: z.array(z.string().trim().min(1).max(500)).max(10).default([]),
});

const actionSchema = z.object({
  postId: z.string().uuid(),
  action: z.enum(["publish", "draft-caption"]),
});

function getBearerToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
}

async function getRequestContext(request: Request) {
  const supabase = getSupabaseAdminClient();
  const token = getBearerToken(request);

  if (!supabase || !token) {
    return null;
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData.user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, organization_id, full_name, role")
    .eq("id", authData.user.id)
    .single<{ id: string; organization_id: string; full_name: string; role: ProfileRole }>();

  return profileError || !profile ? null : { supabase, profile };
}

export async function GET(request: Request) {
  const context = await getRequestContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canManageSocialPosts(context.profile.role)) {
    return NextResponse.json({ error: "Only admins and social media managers can access social posts" }, { status: 403 });
  }

  const { data, error } = await context.supabase
    .from("social_posts")
    .select("id, post_type, title, caption, media_storage_paths, status, scheduled_at, notes, profiles(full_name)")
    .eq("organization_id", context.profile.organization_id)
    .order("scheduled_at", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ posts: (data ?? []).map((post) => mapPost(context.supabase, post)) });
}

export async function POST(request: Request) {
  const context = await getRequestContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canManageSocialPosts(context.profile.role)) {
    return NextResponse.json({ error: "Only admins and social media managers can create social posts" }, { status: 403 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid social post", issues: parsed.error.flatten() }, { status: 400 });
  }

  const mediaPrefix = `${context.profile.organization_id}/${context.profile.id}/`;

  if (parsed.data.mediaStoragePaths.some((path) => !path.startsWith(mediaPrefix))) {
    return NextResponse.json({ error: "Invalid social media path" }, { status: 400 });
  }

  const { data, error } = await context.supabase
    .from("social_posts")
    .insert({
      organization_id: context.profile.organization_id,
      assigned_to: context.profile.id,
      post_type: parsed.data.postType,
      title: parsed.data.title,
      caption: parsed.data.caption,
      media_storage_paths: parsed.data.mediaStoragePaths,
      status: parsed.data.scheduledAt ? "scheduled" : "draft",
      scheduled_at: parsed.data.scheduledAt ?? null,
      notes: parsed.data.notes || null,
    })
    .select("id, post_type, title, caption, media_storage_paths, status, scheduled_at, notes, profiles(full_name)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post: mapPost(context.supabase, data) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await getRequestContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canManageSocialPosts(context.profile.role)) {
    return NextResponse.json({ error: "Only admins and social media managers can update social posts" }, { status: 403 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid social post action", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { data: post, error: postError } = await context.supabase
    .from("social_posts")
    .select("id, post_type, title, caption, media_storage_paths, status, scheduled_at, notes, profiles(full_name)")
    .eq("id", parsed.data.postId)
    .eq("organization_id", context.profile.organization_id)
    .single();

  if (postError || !post) {
    return NextResponse.json({ error: "Social post not found in your organization" }, { status: 404 });
  }

  if (parsed.data.action === "draft-caption") {
    const caption = await draftSocialCaption({ title: post.title, postType: post.post_type });
    const { data, error } = await context.supabase
      .from("social_posts")
      .update({ caption })
      .eq("id", post.id)
      .eq("organization_id", context.profile.organization_id)
      .select("id, post_type, title, caption, media_storage_paths, status, scheduled_at, notes, profiles(full_name)")
      .single();

    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ post: mapPost(context.supabase, data) });
  }

  try {
    const mediaUrls = getMediaUrls(context.supabase, post.media_storage_paths ?? []);
    const result = await publishSocialPost({
      organizationId: context.profile.organization_id,
      postId: post.id,
      postType: post.post_type,
      title: post.title,
      caption: post.caption ?? "",
      mediaUrls,
      scheduledAt: post.scheduled_at,
    });
    const { data, error } = await context.supabase
      .from("social_posts")
      .update({ status: "published" })
      .eq("id", post.id)
      .eq("organization_id", context.profile.organization_id)
      .select("id, post_type, title, caption, media_storage_paths, status, scheduled_at, notes, profiles(full_name)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await context.supabase.from("activities").insert({
      organization_id: context.profile.organization_id,
      actor_id: context.profile.id,
      activity_type: "social_post_published",
      description: `${post.title} marked published`,
      metadata: { postId: post.id, dispatchStatus: result.status },
    });

    return NextResponse.json({ post: mapPost(context.supabase, data), dispatchStatus: result.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Social publishing failed" }, { status: 502 });
  }
}

function mapPost(supabase: ReturnType<typeof getSupabaseAdminClient>, post: {
  id: string;
  post_type: string;
  title: string;
  caption: string | null;
  media_storage_paths: string[] | null;
  status: string;
  scheduled_at: string | null;
  notes: string | null;
  profiles: { full_name: string } | { full_name: string }[] | null;
}) {
  const assignee = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
  const mediaStoragePaths = post.media_storage_paths ?? [];

  return {
    id: post.id,
    title: post.title,
    type: post.post_type,
    caption: post.caption ?? "",
    status: `${post.status[0].toUpperCase()}${post.status.slice(1)}`,
    scheduledFor: post.scheduled_at ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(post.scheduled_at)) : "Not scheduled",
    assignee: assignee?.full_name ?? "Unassigned",
    notes: post.notes ?? undefined,
    mediaStoragePaths,
    mediaUrls: getMediaUrls(supabase, mediaStoragePaths),
  };
}

function getMediaUrls(supabase: ReturnType<typeof getSupabaseAdminClient>, paths: string[]) {
  return paths.map((path) => supabase?.storage.from("social-media").getPublicUrl(path).data.publicUrl).filter(Boolean) as string[];
}

function canManageSocialPosts(role: ProfileRole) {
  return ["admin", "social_media_manager"].includes(role);
}
