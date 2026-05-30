import { getSupabaseAdminClient } from "@/lib/supabase-admin";

interface NotificationInsert {
  organization_id: string;
  user_id: string;
  notification_type: "followup_due" | "social_post_due" | "attendance_issue";
  title: string;
  body: string;
  deduplication_key: string;
  metadata: Record<string, unknown>;
}

interface ProfileRecord {
  id: string;
  organization_id: string;
  full_name: string;
  role: string;
  created_at: string;
}

export async function dispatchScheduledNotifications(referenceDate = new Date()) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase admin client is not configured");
  }

  const horizon = new Date(referenceDate.getTime() + 24 * 60 * 60 * 1000);
  const todayStart = startOfUtcDay(referenceDate);
  const previousDayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const previousDayKey = previousDayStart.toISOString().slice(0, 10);
  const [followups, socialPosts, profiles, attendance] = await Promise.all([
    supabase
      .from("followups")
      .select("id, organization_id, lead_id, assigned_to, due_at, leads(full_name)")
      .is("completed_at", null)
      .lte("due_at", horizon.toISOString()),
    supabase
      .from("social_posts")
      .select("id, organization_id, assigned_to, title, scheduled_at")
      .eq("status", "scheduled")
      .not("scheduled_at", "is", null)
      .lte("scheduled_at", horizon.toISOString()),
    supabase
      .from("profiles")
      .select("id, organization_id, full_name, role, created_at"),
    supabase
      .from("attendance")
      .select("user_id")
      .gte("check_in_time", previousDayStart.toISOString())
      .lt("check_in_time", todayStart.toISOString()),
  ]);
  const error = followups.error ?? socialPosts.error ?? profiles.error ?? attendance.error;

  if (error) {
    throw new Error(error.message);
  }

  const profileRows = (profiles.data ?? []) as ProfileRecord[];
  const notifications = [
    ...buildFollowupNotifications(followups.data ?? []),
    ...buildSocialPostNotifications(socialPosts.data ?? [], profileRows),
    ...buildAttendanceIssueNotifications(profileRows, new Set((attendance.data ?? []).map((record) => record.user_id)), previousDayKey, todayStart),
  ];

  if (!notifications.length) {
    return { eligible: 0, inserted: 0 };
  }

  const { data, error: insertError } = await supabase
    .from("notifications")
    .upsert(notifications, {
      onConflict: "organization_id,user_id,deduplication_key",
      ignoreDuplicates: true,
    })
    .select("id");

  if (insertError) {
    throw new Error(insertError.message);
  }

  return { eligible: notifications.length, inserted: data?.length ?? 0 };
}

function buildFollowupNotifications(followups: {
  id: string;
  organization_id: string;
  lead_id: string;
  assigned_to: string | null;
  due_at: string;
  leads: { full_name: string } | { full_name: string }[] | null;
}[]): NotificationInsert[] {
  return followups.flatMap((followup) => {
    if (!followup.assigned_to) {
      return [];
    }

    const lead = Array.isArray(followup.leads) ? followup.leads[0] : followup.leads;

    return [{
      organization_id: followup.organization_id,
      user_id: followup.assigned_to,
      notification_type: "followup_due",
      title: "Follow-up due soon",
      body: `${lead?.full_name ?? "Lead"} follow-up is due ${formatDateTime(followup.due_at)}.`,
      deduplication_key: `followup_due:${followup.id}:${followup.due_at}`,
      metadata: { followupId: followup.id, leadId: followup.lead_id, dueAt: followup.due_at },
    }];
  });
}

function buildSocialPostNotifications(socialPosts: {
  id: string;
  organization_id: string;
  assigned_to: string | null;
  title: string;
  scheduled_at: string | null;
}[], profiles: ProfileRecord[]): NotificationInsert[] {
  return socialPosts.flatMap((post) => {
    if (!post.scheduled_at) {
      return [];
    }

    const recipients = post.assigned_to
      ? [post.assigned_to]
      : profiles
        .filter((profile) => profile.organization_id === post.organization_id && ["admin", "social_media_manager"].includes(profile.role))
        .map((profile) => profile.id);

    return recipients.map((recipientId) => ({
      organization_id: post.organization_id,
      user_id: recipientId,
      notification_type: "social_post_due",
      title: "Social post due soon",
      body: `${post.title} is scheduled ${formatDateTime(post.scheduled_at as string)}.`,
      deduplication_key: `social_post_due:${post.id}:${post.scheduled_at}`,
      metadata: { postId: post.id, scheduledAt: post.scheduled_at },
    }));
  });
}

function buildAttendanceIssueNotifications(profiles: ProfileRecord[], attendedUserIds: Set<string>, date: string, todayStart: Date): NotificationInsert[] {
  const organizations = new Map<string, ProfileRecord[]>();

  for (const profile of profiles) {
    organizations.set(profile.organization_id, [...organizations.get(profile.organization_id) ?? [], profile]);
  }

  return [...organizations.entries()].flatMap(([organizationId, members]) => {
    const missingMembers = members.filter((member) => new Date(member.created_at) < todayStart && !attendedUserIds.has(member.id));

    if (!missingMembers.length) {
      return [];
    }

    const body = getAttendanceIssueBody(missingMembers);

    return members
      .filter((member) => ["admin", "sales_manager"].includes(member.role))
      .map((recipient) => ({
        organization_id: organizationId,
        user_id: recipient.id,
        notification_type: "attendance_issue",
        title: "Attendance review needed",
        body,
        deduplication_key: `attendance_issue:${date}`,
        metadata: { date, missingUserIds: missingMembers.map((member) => member.id) },
      }));
  });
}

function getAttendanceIssueBody(members: ProfileRecord[]) {
  const names = members.slice(0, 3).map((member) => member.full_name).join(", ");
  const remaining = members.length - 3;
  return `${names}${remaining > 0 ? ` and ${remaining} more` : ""} did not record attendance yesterday.`;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
