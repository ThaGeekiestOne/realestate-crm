import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getInitials, getRoleLabel, type ProfileRole } from "@/lib/auth-types";
import type { TeamMember } from "@/lib/types";

const profileRoles = ["admin", "sales_manager", "sales_agent", "field_executive", "social_media_manager"] as const;
const availabilityStatuses = ["available", "busy", "offline"] as const;

const inviteSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(30),
  role: z.string().trim().transform(normalizeRole).pipe(z.enum(profileRoles)),
});

const updateSchema = z.object({
  memberId: z.string().uuid(),
  role: z.string().trim().transform(normalizeRole).pipe(z.enum(profileRoles)),
  status: z.string().trim().transform((status) => status.toLowerCase()).pipe(z.enum(availabilityStatuses)),
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

export async function GET(request: Request) {
  const context = await getRequestContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    return NextResponse.json({ members: await listTeamMembers(context.supabase, context.profile.organization_id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load team members" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getRequestContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (context.profile.role !== "admin") {
    return NextResponse.json({ error: "Only organization admins can invite team members" }, { status: 403 });
  }

  const parsed = inviteSchema.safeParse(await readJson(request));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid team member invitation", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { data: invitation, error: invitationError } = await context.supabase.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      full_name: parsed.data.fullName,
      organization_id: context.profile.organization_id,
      phone: parsed.data.phone,
      role: parsed.data.role,
    },
  });

  if (invitationError || !invitation.user) {
    return NextResponse.json({ error: invitationError?.message ?? "Unable to create Supabase invitation" }, { status: 400 });
  }

  const { error: profileError } = await context.supabase.from("profiles").insert({
    id: invitation.user.id,
    organization_id: context.profile.organization_id,
    full_name: parsed.data.fullName,
    role: parsed.data.role,
    phone: parsed.data.phone,
  });
  const { error: memberError } = profileError ? { error: profileError } : await context.supabase.from("team_members").insert({
    organization_id: context.profile.organization_id,
    profile_id: invitation.user.id,
    invite_email: parsed.data.email,
    availability_status: "available",
  });

  if (profileError || memberError) {
    await context.supabase.auth.admin.deleteUser(invitation.user.id);
    return NextResponse.json({ error: profileError?.message ?? memberError?.message ?? "Unable to save team invitation" }, { status: 500 });
  }

  const member = await getTeamMember(context.supabase, context.profile.organization_id, invitation.user.id);
  return NextResponse.json({ member }, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await getRequestContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (context.profile.role !== "admin") {
    return NextResponse.json({ error: "Only organization admins can update team members" }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(await readJson(request));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid team member update", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { data: member, error: memberLookupError } = await context.supabase
    .from("team_members")
    .select("profile_id")
    .eq("id", parsed.data.memberId)
    .eq("organization_id", context.profile.organization_id)
    .single<{ profile_id: string }>();

  if (memberLookupError || !member) {
    return NextResponse.json({ error: "Team member not found in your organization" }, { status: 404 });
  }

  const [{ error: memberError }, { error: profileError }] = await Promise.all([
    context.supabase.from("team_members").update({ availability_status: parsed.data.status }).eq("id", parsed.data.memberId),
    context.supabase.from("profiles").update({ role: parsed.data.role }).eq("id", member.profile_id),
  ]);

  if (memberError || profileError) {
    return NextResponse.json({ error: memberError?.message ?? profileError?.message }, { status: 500 });
  }

  return NextResponse.json({ member: await getTeamMember(context.supabase, context.profile.organization_id, member.profile_id) });
}

async function readJson(request: Request) {
  try {
    return await request.json() as unknown;
  } catch {
    return null;
  }
}

async function getTeamMember(supabase: ReturnType<typeof getSupabaseAdminClient>, organizationId: string, profileId: string) {
  const members = await listTeamMembers(supabase!, organizationId);
  const member = members.find((item) => item.profileId === profileId);

  if (!member) {
    throw new Error("Team member could not be loaded after saving");
  }

  return member;
}

async function listTeamMembers(supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>, organizationId: string) {
  const [{ data: members, error: membersError }, { data: leads, error: leadsError }] = await Promise.all([
    supabase
      .from("team_members")
      .select("id, profile_id, invite_email, availability_status, profiles(id, full_name, role, phone)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true }),
    supabase
      .from("leads")
      .select("assigned_agent_id")
      .eq("organization_id", organizationId)
      .not("assigned_agent_id", "is", null),
  ]);

  if (membersError || leadsError) {
    throw new Error(membersError?.message ?? leadsError?.message ?? "Unable to load team members");
  }

  const leadCounts = new Map<string, number>();
  for (const lead of leads ?? []) {
    leadCounts.set(lead.assigned_agent_id, (leadCounts.get(lead.assigned_agent_id) ?? 0) + 1);
  }

  return (members ?? []).flatMap((member) => {
    const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;

    if (!profile) {
      return [];
    }

    return [{
      id: member.id,
      profileId: profile.id,
      name: profile.full_name,
      initials: getInitials(profile.full_name),
      email: member.invite_email ?? undefined,
      role: getRoleLabel(profile.role as ProfileRole),
      phone: profile.phone ?? "No phone",
      status: titleCase(member.availability_status) as TeamMember["status"],
      leads: leadCounts.get(profile.id) ?? 0,
    }];
  });
}

function normalizeRole(role: string) {
  return role.trim().toLowerCase().replace(/\s+/g, "_");
}

function titleCase(value: string) {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}
