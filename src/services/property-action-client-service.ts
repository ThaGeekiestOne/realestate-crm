"use client";

import type { WorkspaceIdentity } from "@/lib/auth-types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Property } from "@/lib/types";

export interface PropertyUpdateInput {
  title: string;
  location: string;
  type: string;
  price: string;
  details: string;
  status: Property["status"];
  address?: string;
  sizeSqft?: number;
  bedrooms?: number;
  bathrooms?: number;
  floor?: string;
  furnishingStatus?: string;
  unitsAvailable?: number;
  ownerDeveloper?: string;
  amenities?: string[];
  notes?: string;
  internalTags?: string[];
}

export async function updateOrganizationProperty(identity: WorkspaceIdentity, property: Property, input: PropertyUpdateInput) {
  if (identity.isDemo) {
    return { ...property, ...input };
  }

  return requestPropertyApi<Property>("PATCH", {
    propertyId: property.id,
    ...input,
  });
}

export async function deleteOrganizationProperty(identity: WorkspaceIdentity, property: Property) {
  if (identity.isDemo) {
    return;
  }

  await requestPropertyApi("DELETE", { propertyId: property.id });
}

async function requestPropertyApi<T = void>(method: "PATCH" | "DELETE", body: Record<string, unknown>) {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Your session expired. Sign in again.");
  }

  const response = await fetch("/api/properties/actions", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const result = await response.json() as { error?: string; property?: T };

  if (!response.ok) {
    throw new Error(result.error ?? "Unable to update property");
  }

  return result.property as T;
}
