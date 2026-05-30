export type ProfileRole =
  | "admin"
  | "sales_manager"
  | "sales_agent"
  | "field_executive"
  | "social_media_manager";

export interface WorkspaceIdentity {
  id: string;
  organizationId: string;
  organizationName: string;
  fullName: string;
  initials: string;
  role: ProfileRole;
  roleLabel: string;
  email: string;
  isDemo: boolean;
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function getRoleLabel(role: ProfileRole) {
  return role
    .split("_")
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
