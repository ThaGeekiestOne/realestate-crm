"use client";

import type { WorkspaceIdentity } from "@/lib/auth-types";
import { activities as demoActivities } from "@/lib/demo-data";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { AnalyticsSnapshot, AttendanceRecord, DashboardActivity, Followup, Lead, Property, SiteVisit } from "@/lib/types";

interface AnalyticsInputs {
  leads: Lead[];
  properties: Property[];
  followups: Followup[];
  attendance: AttendanceRecord[];
  siteVisits: SiteVisit[];
}

export function getDemoAnalyticsSnapshot(inputs: AnalyticsInputs): AnalyticsSnapshot {
  const completedFollowups = 12;
  const pipeline = countBy(inputs.leads, (lead) => lead.status);
  const wonLeads = pipeline.Won ?? 0;
  const lostLeads = pipeline.Lost ?? 0;

  return {
    newLeadsToday: inputs.leads.length,
    callsToday: 4,
    followupsDueToday: inputs.followups.length,
    urgentFollowups: inputs.followups.filter((followup) => followup.overdue).length,
    siteVisitsToday: inputs.siteVisits.filter((siteVisit) => siteVisit.status === "Scheduled" && isDemoVisitToday(siteVisit.scheduledFor)).length,
    availableProperties: inputs.properties.filter((property) => property.status === "Available").length,
    teamCheckedIn: inputs.attendance.filter((record) => record.status === "Checked in").length,
    completedFollowups,
    totalFollowups: completedFollowups + inputs.followups.length,
    propertyShares: 1,
    wonLeads,
    lostLeads,
    conversionRate: percent(wonLeads, inputs.leads.length),
    pipeline,
    sources: toCounts(inputs.leads, (lead) => lead.source),
    agentPerformance: [
      { name: "Riya Kapoor", calls: 3 },
      { name: "Kabir Singh", calls: 1 },
    ],
    recentActivities: demoActivities.map((activity, index) => ({ id: `demo-${index}`, ...activity })) as DashboardActivity[],
  };
}

export async function getOrganizationAnalyticsSnapshot(identity: WorkspaceIdentity): Promise<AnalyticsSnapshot> {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase browser client is not configured");
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.toISOString();

  const [leads, properties, calls, followups, shares, attendance, activities, siteVisits] = await Promise.all([
    supabase.from("leads").select("id, source, status, created_at").eq("organization_id", identity.organizationId),
    supabase.from("properties").select("id, availability_status").eq("organization_id", identity.organizationId),
    supabase.from("calls").select("id, created_at, profiles(full_name)").eq("organization_id", identity.organizationId),
    supabase.from("followups").select("id, channel, due_at, completed_at").eq("organization_id", identity.organizationId),
    supabase.from("lead_property_shares").select("id").eq("organization_id", identity.organizationId),
    supabase.from("attendance").select("id, user_id, check_out_time").eq("organization_id", identity.organizationId).gte("check_in_time", today),
    supabase.from("activities").select("id, activity_type, description, created_at").eq("organization_id", identity.organizationId).order("created_at", { ascending: false }).limit(5),
    supabase.from("tasks").select("id, due_at, completed_at").eq("organization_id", identity.organizationId).eq("task_type", "site_visit"),
  ]);
  const error = leads.error ?? properties.error ?? calls.error ?? followups.error ?? shares.error ?? attendance.error ?? activities.error ?? siteVisits.error;

  if (error) {
    throw new Error(error.message);
  }

  const leadRows = leads.data ?? [];
  const propertyRows = properties.data ?? [];
  const callRows = calls.data ?? [];
  const followupRows = followups.data ?? [];
  const attendanceRows = attendance.data ?? [];
  const pipeline = countBy(leadRows, (lead) => normalizeLeadStatus(lead.status));
  const completedFollowups = followupRows.filter((followup) => followup.completed_at).length;
  const openFollowups = followupRows.filter((followup) => !followup.completed_at);
  const wonLeads = pipeline.Won ?? 0;
  const lostLeads = pipeline.Lost ?? 0;

  return {
    newLeadsToday: leadRows.filter((lead) => lead.created_at >= today).length,
    callsToday: callRows.filter((call) => call.created_at >= today).length,
    followupsDueToday: openFollowups.filter((followup) => isToday(followup.due_at)).length,
    urgentFollowups: openFollowups.filter((followup) => new Date(followup.due_at).getTime() < Date.now()).length,
    siteVisitsToday: (siteVisits.data ?? []).filter((siteVisit) => !siteVisit.completed_at && siteVisit.due_at && isToday(siteVisit.due_at)).length,
    availableProperties: propertyRows.filter((property) => property.availability_status === "Available").length,
    teamCheckedIn: attendanceRows.filter((record) => !record.check_out_time).length,
    completedFollowups,
    totalFollowups: followupRows.length,
    propertyShares: shares.data?.length ?? 0,
    wonLeads,
    lostLeads,
    conversionRate: percent(wonLeads, leadRows.length),
    pipeline,
    sources: toCounts(leadRows, (lead) => lead.source),
    agentPerformance: getAgentPerformance(callRows),
    recentActivities: (activities.data ?? []).map((activity) => ({
      id: activity.id,
      icon: getActivityIcon(activity.activity_type),
      text: activity.description,
      detail: formatActivityType(activity.activity_type),
      time: formatRelativeTime(activity.created_at),
    })),
  };
}

function getAgentPerformance(calls: { profiles: { full_name: string } | { full_name: string }[] | null }[]) {
  const counts = countBy(calls, (call) => {
    const profile = Array.isArray(call.profiles) ? call.profiles[0] : call.profiles;
    return profile?.full_name ?? "Unassigned";
  });

  return Object.entries(counts)
    .map(([name, count]) => ({ name, calls: count }))
    .sort((left, right) => right.calls - left.calls);
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function toCounts<T>(items: T[], getKey: (item: T) => string) {
  return Object.entries(countBy(items, getKey))
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);
}

function normalizeLeadStatus(status: string) {
  return status === "Site Visit Scheduled" ? "Site Visit" : status;
}

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function isDemoVisitToday(value: string) {
  return /^today\b/i.test(value) || (!Number.isNaN(Date.parse(value)) && isToday(value));
}

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function getActivityIcon(activityType: string): DashboardActivity["icon"] {
  if (activityType.includes("share")) return "share";
  if (activityType.includes("call")) return "phone";
  if (activityType.includes("visit") || activityType.includes("attendance")) return "visit";
  return "lead";
}

function formatActivityType(activityType: string) {
  return activityType.split("_").map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(" ");
}

function formatRelativeTime(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  return minutes < 60 ? `${minutes}m` : `${Math.round(minutes / 60)}h`;
}
