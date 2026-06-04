"use client";

import type { User } from "@supabase/supabase-js";
import { getInitials, getRoleLabel, type ProfileRole, type WorkspaceIdentity } from "@/lib/auth-types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

interface ProfileRecord {
  id: string;
  organization_id: string;
  full_name: string;
  role: ProfileRole;
  organizations: { name: string } | { name: string }[] | null;
}

function getOrganizationName(organizations: ProfileRecord["organizations"]) {
  if (Array.isArray(organizations)) {
    return organizations[0]?.name ?? "Estate AI Flow Workspace";
  }

  return organizations?.name ?? "Estate AI Flow Workspace";
}

export async function getWorkspaceIdentity(user: User): Promise<WorkspaceIdentity> {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase browser client is not configured");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, organization_id, full_name, role, organizations(name)")
    .eq("id", user.id)
    .single<ProfileRecord>();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id,
    organizationId: data.organization_id,
    organizationName: getOrganizationName(data.organizations),
    fullName: data.full_name,
    initials: getInitials(data.full_name),
    role: data.role,
    roleLabel: getRoleLabel(data.role),
    email: user.email ?? "",
    isDemo: false,
  };
}
