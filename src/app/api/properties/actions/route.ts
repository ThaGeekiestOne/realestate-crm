import { NextResponse } from "next/server";
import { z } from "zod";
import type { ProfileRole } from "@/lib/auth-types";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Property } from "@/lib/types";

const statuses = ["Available", "Hold", "Sold", "Rented"] as const;
const optionalText = z.string().trim().max(1000).optional();
const optionalNumber = z.number().nonnegative().optional();

const updateSchema = z.object({
  propertyId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  location: z.string().trim().min(2).max(160),
  type: z.string().trim().min(2).max(120),
  price: z.string().trim().min(1).max(80).refine((value) => parseMoney(value) !== null, "Enter a valid property price"),
  details: z.string().trim().max(1000),
  status: z.enum(statuses),
  address: optionalText,
  sizeSqft: optionalNumber,
  bedrooms: optionalNumber,
  bathrooms: optionalNumber,
  floor: optionalText,
  furnishingStatus: optionalText,
  unitsAvailable: optionalNumber,
  ownerDeveloper: optionalText,
  amenities: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  notes: z.string().trim().max(3000).optional(),
  internalTags: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
});

const deleteSchema = z.object({
  propertyId: z.string().uuid(),
});

function getBearerToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
}

async function getRequestContext(request: Request) {
  const supabase = getSupabaseAdminClient();
  const token = getBearerToken(request);

  if (!supabase || !token) {
    return null;
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData.user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", authData.user.id)
    .single<{ id: string; organization_id: string; role: ProfileRole }>();

  return profileError || !profile ? null : { supabase, profile };
}

export async function PATCH(request: Request) {
  const context = await getRequestContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canManageInventory(context.profile.role)) {
    return NextResponse.json({ error: "Only admins and sales managers can update inventory" }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(await readJson(request));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid property update", issues: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const { data: property, error } = await context.supabase
    .from("properties")
    .update({
      title: input.title,
      location: input.location,
      property_type: input.type,
      price: parseMoney(input.price),
      description: input.details,
      availability_status: input.status,
      address: input.address || null,
      size_sqft: input.sizeSqft ?? null,
      bedrooms: input.bedrooms ?? null,
      bathrooms: input.bathrooms ?? null,
      floor: input.floor || null,
      furnishing_status: input.furnishingStatus || null,
      units_available: input.unitsAvailable ?? 1,
      owner_developer: input.ownerDeveloper || null,
      amenities: input.amenities ?? [],
      notes: input.notes || null,
      internal_tags: input.internalTags ?? [],
    })
    .eq("id", input.propertyId)
    .eq("organization_id", context.profile.organization_id)
    .select("id")
    .single();

  if (error || !property) {
    return NextResponse.json({ error: "Property not found in your organization" }, { status: 404 });
  }

  return NextResponse.json({ property: toPropertyUpdate(input) });
}

export async function DELETE(request: Request) {
  const context = await getRequestContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canManageInventory(context.profile.role)) {
    return NextResponse.json({ error: "Only admins and sales managers can delete inventory" }, { status: 403 });
  }

  const parsed = deleteSchema.safeParse(await readJson(request));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid property deletion", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { data: property, error: propertyError } = await context.supabase
    .from("properties")
    .select("id, property_images(storage_path), property_documents(storage_path)")
    .eq("id", parsed.data.propertyId)
    .eq("organization_id", context.profile.organization_id)
    .single<{ id: string; property_images: { storage_path: string }[] | null; property_documents: { storage_path: string }[] | null }>();

  if (propertyError || !property) {
    return NextResponse.json({ error: "Property not found in your organization" }, { status: 404 });
  }

  const storagePaths = (property.property_images ?? []).map((image) => image.storage_path);
  const documentPaths = (property.property_documents ?? []).map((document) => document.storage_path);

  if (storagePaths.length) {
    const { error } = await context.supabase.storage.from("property-media").remove(storagePaths);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (documentPaths.length) {
    const { error } = await context.supabase.storage.from("property-documents").remove(documentPaths);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { error } = await context.supabase
    .from("properties")
    .delete()
    .eq("id", property.id)
    .eq("organization_id", context.profile.organization_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}

async function readJson(request: Request) {
  try {
    return await request.json() as unknown;
  } catch {
    return null;
  }
}

function canManageInventory(role: ProfileRole) {
  return role === "admin" || role === "sales_manager";
}

function parseMoney(value: string) {
  const normalized = value.toLowerCase().replace(/[^0-9.a-z]/g, "");
  const amount = Number.parseFloat(normalized);

  if (!Number.isFinite(amount)) {
    return null;
  }

  if (normalized.includes("cr")) {
    return Math.round(amount * 10000000);
  }

  if (normalized.includes("l")) {
    return Math.round(amount * 100000);
  }

  return Math.round(amount);
}

function toPropertyUpdate(input: z.infer<typeof updateSchema>): Partial<Property> {
  return {
    title: input.title,
    location: input.location,
    type: input.type,
    price: input.price,
    details: input.details,
    status: input.status,
    address: input.address,
    sizeSqft: input.sizeSqft,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    floor: input.floor,
    furnishingStatus: input.furnishingStatus,
    unitsAvailable: input.unitsAvailable,
    ownerDeveloper: input.ownerDeveloper,
    amenities: input.amenities,
    notes: input.notes,
    internalTags: input.internalTags,
  };
}
