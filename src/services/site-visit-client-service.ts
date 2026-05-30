"use client";

import type { WorkspaceIdentity } from "@/lib/auth-types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { SiteVisit } from "@/lib/types";

export async function getOrganizationSiteVisits(identity: WorkspaceIdentity) {
  if (identity.isDemo) {
    throw new Error("Demo site visits are stored locally.");
  }

  return requestSiteVisitApi<SiteVisit[]>("GET");
}

export async function createOrganizationSiteVisit(identity: WorkspaceIdentity, siteVisit: SiteVisit) {
  if (identity.isDemo) {
    return siteVisit;
  }

  return requestSiteVisitApi<SiteVisit>("POST", {
    leadId: siteVisit.leadId,
    assigneeId: siteVisit.assigneeId,
    location: siteVisit.location,
    scheduledAt: siteVisit.scheduledFor,
    notes: siteVisit.notes,
  });
}

export async function updateOrganizationSiteVisit(identity: WorkspaceIdentity, siteVisit: SiteVisit, notes: string, complete = false) {
  if (identity.isDemo) {
    return {
      ...siteVisit,
      notes,
      status: complete ? "Completed" as const : siteVisit.status,
      completedAt: complete ? "Just now" : siteVisit.completedAt,
    };
  }

  return requestSiteVisitApi<SiteVisit>("PATCH", {
    siteVisitId: siteVisit.id,
    notes,
    action: complete ? "complete" : "save-notes",
  });
}

async function requestSiteVisitApi<T>(method: "GET" | "POST" | "PATCH", body?: Record<string, unknown>) {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Your session expired. Sign in again.");
  }

  const response = await fetch("/api/site-visits", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json() as { error?: string; siteVisit?: SiteVisit; siteVisits?: SiteVisit[] };

  if (!response.ok) {
    throw new Error(result.error ?? "Unable to update site visit");
  }

  return (method === "GET" ? result.siteVisits : result.siteVisit) as T;
}
