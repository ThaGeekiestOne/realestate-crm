import type { ProfileRole } from "@/lib/auth-types";

export function canAccessLead(role: ProfileRole, profileId: string, assignedAgentId: string | null) {
  return role === "admin" || role === "sales_manager" || (role === "sales_agent" && assignedAgentId === profileId);
}

export function canManageLeadAssignment(role: ProfileRole) {
  return role === "admin" || role === "sales_manager";
}
