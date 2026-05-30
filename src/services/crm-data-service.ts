"use client";

import type { WorkspaceIdentity } from "@/lib/auth-types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Followup, Lead, LeadStatus, LeadTemperature, Property } from "@/lib/types";

interface LeadRecord {
  id: string;
  full_name: string;
  phone: string;
  source: string;
  property_type: string | null;
  budget_min: number | null;
  budget_max: number | null;
  preferred_location: string | null;
  status: string;
  temperature: string;
  notes: string | null;
  next_followup_at: string | null;
  created_at: string;
  profiles: { full_name: string } | { full_name: string }[] | null;
}

interface PropertyRecord {
  id: string;
  title: string;
  location: string;
  property_type: string | null;
  price: number | null;
  description: string | null;
  address: string | null;
  size_sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: string | null;
  furnishing_status: string | null;
  availability_status: Property["status"];
  units_available: number;
  owner_developer: string | null;
  amenities: string[];
  notes: string | null;
  internal_tags: string[];
  property_images?: { storage_path: string }[] | null;
}

interface FollowupRecord {
  id: string;
  due_at: string;
  channel: string | null;
  notes: string | null;
  leads: { full_name: string; temperature: string } | { full_name: string; temperature: string }[] | null;
}

export interface OrganizationWorkspaceSnapshot {
  leads: Lead[];
  properties: Property[];
  followups: Followup[];
}

export interface CreateOrganizationLeadInput {
  name: string;
  phone: string;
  source: string;
  propertyType: string;
  budget: string;
  location: string;
  temperature: LeadTemperature;
  note: string;
}

export interface CreateOrganizationPropertyInput {
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

export interface CreateOrganizationFollowupInput {
  lead: string;
  purpose: string;
  time: string;
  channel: Followup["channel"];
}

function requireSupabase() {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase browser client is not configured");
  }

  return supabase;
}

function getJoinedRecord<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] : value;
}

function formatCurrency(value: number | null) {
  if (!value) {
    return "Price on request";
  }

  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(2).replace(/\.?0+$/, "")} Cr`;
  }

  return `₹${(value / 100000).toFixed(0)} L`;
}

function formatBudget(min: number | null, max: number | null) {
  if (!min && !max) {
    return "Budget not set";
  }

  return `${formatCurrency(min)}–${formatCurrency(max)}`;
}

function parseMoney(value: string) {
  const normalized = value.toLowerCase().replace(/[₹,\s]/g, "");
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

function parseBudget(value: string) {
  const [min, max] = value.split(/[–-]/).map(parseMoney);
  return {
    budgetMin: min,
    budgetMax: max ?? min,
  };
}

function parseFollowupTime(value: string) {
  const normalized = value.trim();
  const relativeMatch = normalized.match(/^(today|tomorrow),?\s+(.+)$/i);

  if (relativeMatch) {
    const date = new Date();
    if (relativeMatch[1].toLowerCase() === "tomorrow") {
      date.setDate(date.getDate() + 1);
    }

    const time = relativeMatch[2].match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
    if (time) {
      let hours = Number(time[1]) % 12;
      if (time[3].toLowerCase() === "pm") {
        hours += 12;
      }

      date.setHours(hours, Number(time[2] ?? 0), 0, 0);
      return date.toISOString();
    }
  }

  const timestamp = Date.parse(normalized);
  if (Number.isNaN(timestamp)) {
    throw new Error("Enter a follow-up time such as Tomorrow, 11:00 AM.");
  }

  return new Date(timestamp).toISOString();
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeStatus(status: string): LeadStatus {
  if (status === "Site Visit Scheduled") {
    return "Site Visit";
  }

  if (["New", "Contacted", "Interested", "Site Visit", "Negotiation", "Won", "Lost", "Not Responding"].includes(status)) {
    return status as LeadStatus;
  }

  return "New";
}

function normalizeTemperature(temperature: string): LeadTemperature {
  return ["Hot", "Warm", "Cold"].includes(temperature) ? temperature as LeadTemperature : "Warm";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function mapLead(record: LeadRecord): Lead {
  const assignedProfile = getJoinedRecord(record.profiles);

  return {
    id: record.id,
    name: record.full_name,
    initials: getInitials(record.full_name),
    phone: record.phone,
    source: record.source,
    propertyType: record.property_type ?? "Not specified",
    budget: formatBudget(record.budget_min, record.budget_max),
    location: record.preferred_location ?? "Location not set",
    status: normalizeStatus(record.status),
    temperature: normalizeTemperature(record.temperature),
    agent: assignedProfile?.full_name ?? "Unassigned",
    nextFollowup: formatDateTime(record.next_followup_at),
    created: formatDateTime(record.created_at),
    note: record.notes ?? "No notes added yet.",
  };
}

function mapProperty(record: PropertyRecord): Property {
  const supabase = getSupabaseBrowserClient();
  const images = (record.property_images ?? []).map(({ storage_path }) => (
    supabase?.storage.from("property-media").getPublicUrl(storage_path).data.publicUrl
  )).filter(Boolean) as string[];

  return {
    id: record.id,
    title: record.title,
    location: record.location,
    type: record.property_type ?? "Property",
    price: formatCurrency(record.price),
    details: record.size_sqft ? `${record.size_sqft.toLocaleString("en-IN")} sq.ft. · ${record.units_available} units available` : `${record.units_available} units available`,
    status: record.availability_status,
    image: images[0] ?? "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80",
    images,
    matches: 0,
    address: record.address ?? undefined,
    sizeSqft: record.size_sqft ?? undefined,
    bedrooms: record.bedrooms ?? undefined,
    bathrooms: record.bathrooms ?? undefined,
    floor: record.floor ?? undefined,
    furnishingStatus: record.furnishing_status ?? undefined,
    unitsAvailable: record.units_available,
    ownerDeveloper: record.owner_developer ?? undefined,
    amenities: record.amenities,
    notes: record.notes ?? record.description ?? undefined,
    internalTags: record.internal_tags,
  };
}

function mapFollowup(record: FollowupRecord): Followup {
  const lead = getJoinedRecord(record.leads);
  const name = lead?.full_name ?? "Unassigned lead";

  return {
    id: record.id,
    lead: name,
    initials: getInitials(name),
    purpose: record.notes ?? "Scheduled follow-up",
    time: formatDateTime(record.due_at),
    channel: record.channel === "whatsapp"
      ? "WhatsApp"
      : record.channel === "sms"
        ? "SMS"
        : record.channel === "email"
          ? "Email"
          : record.channel === "site_visit"
            ? "Site visit"
            : "Call",
    temperature: normalizeTemperature(lead?.temperature ?? "Warm"),
    overdue: new Date(record.due_at).getTime() < Date.now(),
  };
}

export async function getOrganizationWorkspaceSnapshot(identity: WorkspaceIdentity): Promise<OrganizationWorkspaceSnapshot> {
  const supabase = requireSupabase();

  const [leadsResult, propertiesResult, followupsResult] = await Promise.all([
    supabase
      .from("leads")
      .select("id, full_name, phone, source, property_type, budget_min, budget_max, preferred_location, status, temperature, notes, next_followup_at, created_at, profiles(full_name)")
      .eq("organization_id", identity.organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("properties")
      .select("id, title, location, property_type, price, description, address, size_sqft, bedrooms, bathrooms, floor, furnishing_status, availability_status, units_available, owner_developer, amenities, notes, internal_tags, property_images(storage_path)")
      .eq("organization_id", identity.organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("followups")
      .select("id, due_at, channel, notes, leads(full_name, temperature)")
      .eq("organization_id", identity.organizationId)
      .is("completed_at", null)
      .order("due_at", { ascending: true }),
  ]);

  if (leadsResult.error || propertiesResult.error || followupsResult.error) {
    throw new Error(leadsResult.error?.message ?? propertiesResult.error?.message ?? followupsResult.error?.message ?? "Unable to load workspace data");
  }

  return {
    leads: (leadsResult.data as LeadRecord[]).map(mapLead),
    properties: (propertiesResult.data as PropertyRecord[]).map(mapProperty),
    followups: (followupsResult.data as FollowupRecord[]).map(mapFollowup),
  };
}

export async function createOrganizationLead(identity: WorkspaceIdentity, input: CreateOrganizationLeadInput) {
  const supabase = requireSupabase();
  const { budgetMin, budgetMax } = parseBudget(input.budget);
  const { data: agents, error: assignmentError } = await supabase.rpc("assign_next_sales_agent", {
    target_organization_id: identity.organizationId,
  });

  if (assignmentError) {
    throw new Error(assignmentError.message);
  }

  const assignedAgent = agents?.[0] as { agent_id: string; full_name: string } | undefined;
  const fallbackAgentId = ["sales_manager", "sales_agent"].includes(identity.role) ? identity.id : null;
  const assignedAgentId = assignedAgent?.agent_id ?? fallbackAgentId;

  if (!assignedAgentId) {
    throw new Error("No available sales agent could be assigned.");
  }

  const { data, error } = await supabase
    .from("leads")
    .insert({
      organization_id: identity.organizationId,
      assigned_agent_id: assignedAgentId,
      full_name: input.name,
      phone: input.phone,
      source: input.source,
      property_type: input.propertyType,
      budget_min: budgetMin,
      budget_max: budgetMax,
      preferred_location: input.location,
      temperature: input.temperature,
      notes: input.note,
    })
    .select("id, full_name, phone, source, property_type, budget_min, budget_max, preferred_location, status, temperature, notes, next_followup_at, created_at, profiles(full_name)")
    .single<LeadRecord>();

  if (error) {
    throw new Error(error.message);
  }

  return mapLead(data);
}

export async function createOrganizationProperty(identity: WorkspaceIdentity, input: CreateOrganizationPropertyInput, files: File[] = []) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("properties")
    .insert({
      organization_id: identity.organizationId,
      title: input.title,
      location: input.location,
      property_type: input.type,
      price: parseMoney(input.price),
      availability_status: input.status,
      description: input.details,
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
    .select("id, title, location, property_type, price, description, address, size_sqft, bedrooms, bathrooms, floor, furnishing_status, availability_status, units_available, owner_developer, amenities, notes, internal_tags")
    .single<PropertyRecord>();

  if (error) {
    throw new Error(error.message);
  }

  if (!files.length) {
    return mapProperty(data);
  }

  const uploadedPaths: string[] = [];

  for (const [index, file] of files.entries()) {
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${identity.organizationId}/${data.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("property-media").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    uploadedPaths.push(path);
    const { error: imageError } = await supabase.from("property_images").insert({
      organization_id: identity.organizationId,
      property_id: data.id,
      storage_path: path,
      alt_text: input.title,
      sort_order: index,
    });

    if (imageError) {
      throw new Error(imageError.message);
    }
  }

  return mapProperty({ ...data, property_images: uploadedPaths.map((storage_path) => ({ storage_path })) });
}

export async function createOrganizationFollowup(identity: WorkspaceIdentity, input: CreateOrganizationFollowupInput) {
  const supabase = requireSupabase();
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id")
    .eq("organization_id", identity.organizationId)
    .ilike("full_name", input.lead)
    .limit(1)
    .single<{ id: string }>();

  if (leadError) {
    throw new Error("Select an existing lead before scheduling a follow-up.");
  }

  const channel = input.channel === "WhatsApp"
    ? "whatsapp"
    : input.channel === "SMS"
      ? "sms"
      : input.channel === "Email"
        ? "email"
        : input.channel === "Site visit"
          ? "site_visit"
          : "call";
  const { data, error } = await supabase
    .from("followups")
    .insert({
      organization_id: identity.organizationId,
      lead_id: lead.id,
      assigned_to: identity.id,
      due_at: parseFollowupTime(input.time),
      channel,
      notes: input.purpose,
    })
    .select("id, due_at, channel, notes, leads(full_name, temperature)")
    .single<FollowupRecord>();

  if (error) {
    throw new Error(error.message);
  }

  return mapFollowup(data);
}

export async function completeOrganizationFollowup(identity: WorkspaceIdentity, followupId: string) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("followups")
    .update({ completed_at: new Date().toISOString() })
    .eq("organization_id", identity.organizationId)
    .eq("id", followupId);

  if (error) {
    throw new Error(error.message);
  }
}
