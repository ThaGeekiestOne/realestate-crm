"use client";

import type { WorkspaceIdentity } from "@/lib/auth-types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Lead, Property } from "@/lib/types";

export type PropertyShareChannel = "whatsapp" | "sms" | "email";

export async function shareLeadProperty(identity: WorkspaceIdentity, lead: Lead, property: Property, channel: PropertyShareChannel) {
  if (identity.isDemo) {
    return {
      shareUrl: new URL(`/share/properties/${getDemoPropertyToken(property)}`, window.location.origin).toString(),
      status: "simulated",
    };
  }

  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Your session expired. Sign in again.");
  }

  const response = await fetch("/api/property-shares", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      leadId: lead.id,
      propertyId: property.id,
      channel,
    }),
  });
  const result = await response.json() as { error?: string; shareUrl?: string; status?: string };

  if (!response.ok || !result.shareUrl) {
    throw new Error(result.error ?? "Unable to share property");
  }

  return {
    shareUrl: result.shareUrl,
    status: result.status ?? "queued",
  };
}

function getDemoPropertyToken(property: Property) {
  const payload = JSON.stringify({
    title: property.title,
    location: property.location,
    type: property.type,
    price: property.price,
    details: property.details,
    images: property.images?.length ? property.images : [property.image],
  });
  const bytes = new TextEncoder().encode(payload);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  const encoded = window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return `demo-data-${encoded}`;
}
