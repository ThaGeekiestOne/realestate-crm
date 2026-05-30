import "server-only";

import { properties as demoProperties } from "@/lib/demo-data";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export interface PublicPropertyShare {
  title: string;
  location: string;
  type: string;
  price: string;
  description: string;
  images: string[];
  sharedBy: string;
}

export async function getPublicPropertyShare(token: string): Promise<PublicPropertyShare | null> {
  if (token.startsWith("demo-data-")) {
    return decodeDemoPropertyShare(token.slice("demo-data-".length));
  }

  if (token.startsWith("demo-")) {
    const property = demoProperties.find((item) => item.id === token.slice(5));

    return property ? {
      title: property.title,
      location: property.location,
      type: property.type,
      price: property.price,
      description: property.details,
      images: property.images?.length ? property.images : [property.image],
      sharedBy: "EstateFlow Demo Realty",
    } : null;
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("lead_property_shares")
    .select("properties!inner(title, location, property_type, price, description, property_images(storage_path)), organizations!inner(name)")
    .eq("public_token", token)
    .single();

  if (error || !data) {
    return null;
  }

  const property = Array.isArray(data.properties) ? data.properties[0] : data.properties;
  const organization = Array.isArray(data.organizations) ? data.organizations[0] : data.organizations;
  const images = (property.property_images ?? []).map(({ storage_path }: { storage_path: string }) => (
    supabase.storage.from("property-media").getPublicUrl(storage_path).data.publicUrl
  ));

  return {
    title: property.title,
    location: property.location,
    type: property.property_type ?? "Property",
    price: formatCurrency(property.price),
    description: property.description ?? "Contact our property advisor for full details.",
    images,
    sharedBy: organization.name,
  };
}

function formatCurrency(value: number | null) {
  if (!value) {
    return "Price on request";
  }

  return value >= 10000000
    ? `INR ${(value / 10000000).toFixed(2).replace(/\.?0+$/, "")} Cr`
    : `INR ${(value / 100000).toFixed(0)} L`;
}

function decodeDemoPropertyShare(payload: string): PublicPropertyShare | null {
  try {
    const property = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    const images = Array.isArray(property.images)
      ? property.images.filter((image): image is string => typeof image === "string")
      : [];

    if (
      typeof property.title !== "string"
      || typeof property.location !== "string"
      || typeof property.type !== "string"
      || typeof property.price !== "string"
      || typeof property.details !== "string"
    ) {
      return null;
    }

    return {
      title: property.title,
      location: property.location,
      type: property.type,
      price: property.price,
      description: property.details,
      images,
      sharedBy: "EstateFlow Demo Realty",
    };
  } catch {
    return null;
  }
}
