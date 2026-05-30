"use client";

import type { WorkspaceIdentity } from "@/lib/auth-types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { TeamMember } from "@/lib/types";

export async function getOrganizationTeamMembers(identity: WorkspaceIdentity) {
  if (identity.isDemo) {
    throw new Error("Demo team members are stored locally.");
  }

  return requestTeamApi<TeamMember[]>("GET");
}

export async function inviteOrganizationTeamMember(identity: WorkspaceIdentity, member: TeamMember) {
  if (identity.isDemo) {
    return member;
  }

  return requestTeamApi<TeamMember>("POST", {
    fullName: member.name,
    email: member.email,
    phone: member.phone,
    role: member.role,
  });
}

export async function updateOrganizationTeamMember(identity: WorkspaceIdentity, member: TeamMember) {
  if (identity.isDemo) {
    return member;
  }

  return requestTeamApi<TeamMember>("PATCH", {
    memberId: member.id,
    role: member.role,
    status: member.status,
  });
}

async function requestTeamApi<T>(method: "GET" | "POST" | "PATCH", body?: Record<string, unknown>) {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Your session expired. Sign in again.");
  }

  const response = await fetch("/api/team-members", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json() as { error?: string; member?: TeamMember; members?: TeamMember[] };

  if (!response.ok) {
    throw new Error(result.error ?? "Unable to update team members");
  }

  return (method === "GET" ? result.members : result.member) as T;
}
