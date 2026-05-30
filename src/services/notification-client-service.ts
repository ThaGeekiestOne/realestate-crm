"use client";

import type { WorkspaceIdentity } from "@/lib/auth-types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { WorkspaceNotification } from "@/lib/types";

export async function getOrganizationNotifications(identity: WorkspaceIdentity) {
  if (identity.isDemo) {
    return [];
  }

  return requestNotificationApi<WorkspaceNotification[]>("GET");
}

export async function markOrganizationNotificationRead(identity: WorkspaceIdentity, notificationId?: string) {
  if (identity.isDemo) {
    return;
  }

  await requestNotificationApi("PATCH", notificationId ? { notificationId } : { all: true });
}

async function requestNotificationApi<T = void>(method: "GET" | "PATCH", body?: Record<string, unknown>) {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Your session expired. Sign in again.");
  }

  const response = await fetch("/api/notifications", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json() as { error?: string; notifications?: WorkspaceNotification[] };

  if (!response.ok) {
    throw new Error(result.error ?? "Unable to update notifications");
  }

  return result.notifications as T;
}
