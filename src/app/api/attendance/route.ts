import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const attendanceSchema = z.object({
  action: z.enum(["check-in", "check-out"]),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  notes: z.string().trim().max(500).default(""),
  selfieStoragePath: z.string().trim().max(500).optional(),
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
    .select("id, organization_id, full_name, role")
    .eq("id", authData.user.id)
    .single();

  return profileError || !profile ? null : { supabase, profile };
}

export async function GET(request: Request) {
  const context = await getRequestContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [{ data: profiles, error: profilesError }, { data: today, error: todayError }, { data: history, error: historyError }] = await Promise.all([
    context.supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("organization_id", context.profile.organization_id)
      .order("full_name"),
    context.supabase
      .from("attendance")
      .select("id, user_id, check_in_time, check_out_time, check_in_latitude, check_in_longitude, check_out_latitude, check_out_longitude, status, notes, selfie_storage_path")
      .eq("organization_id", context.profile.organization_id)
      .gte("check_in_time", startOfToday.toISOString())
      .order("check_in_time", { ascending: false }),
    context.supabase
      .from("attendance")
      .select("id, check_in_time, check_out_time, check_in_latitude, check_in_longitude, check_out_latitude, check_out_longitude, notes, selfie_storage_path")
      .eq("organization_id", context.profile.organization_id)
      .eq("user_id", context.profile.id)
      .order("check_in_time", { ascending: false })
      .limit(14),
  ]);

  if (profilesError || todayError || historyError) {
    return NextResponse.json({ error: profilesError?.message ?? todayError?.message ?? historyError?.message }, { status: 500 });
  }

  const records = (profiles ?? []).map((profile) => {
    const attendance = (today ?? []).find((item) => item.user_id === profile.id);

    return {
      id: attendance?.id ?? `absent-${profile.id}`,
      userId: profile.id,
      name: profile.full_name,
      initials: getInitials(profile.full_name),
      role: formatRole(profile.role),
      status: attendance ? attendance.check_out_time ? "Checked out" : "Checked in" : "Absent",
      checkIn: formatTime(attendance?.check_in_time),
      checkOut: formatTime(attendance?.check_out_time),
      location: attendance ? getAttendanceLocation(attendance) : undefined,
      notes: attendance?.notes ?? undefined,
      selfieStoragePath: attendance?.selfie_storage_path ?? undefined,
    };
  });

  return NextResponse.json({
    records,
    history: (history ?? []).map((attendance) => ({
      id: attendance.id,
      date: formatDate(attendance.check_in_time),
      status: attendance.check_out_time ? "Checked out" : "Checked in",
      checkIn: formatTime(attendance.check_in_time),
      checkOut: formatTime(attendance.check_out_time),
      location: getAttendanceLocation(attendance),
      notes: attendance.notes ?? undefined,
      selfieStoragePath: attendance.selfie_storage_path ?? undefined,
    })),
  });
}

export async function POST(request: Request) {
  const context = await getRequestContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = attendanceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid attendance request", issues: parsed.error.flatten() }, { status: 400 });
  }

  const selfiePrefix = `${context.profile.organization_id}/${context.profile.id}/`;

  if (parsed.data.selfieStoragePath && !parsed.data.selfieStoragePath.startsWith(selfiePrefix)) {
    return NextResponse.json({ error: "Invalid attendance selfie path" }, { status: 400 });
  }

  const { data: openAttendance, error: openError } = await context.supabase
    .from("attendance")
    .select("id")
    .eq("organization_id", context.profile.organization_id)
    .eq("user_id", context.profile.id)
    .is("check_out_time", null)
    .order("check_in_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openError) {
    return NextResponse.json({ error: openError.message }, { status: 500 });
  }

  if (parsed.data.action === "check-in") {
    if (openAttendance) {
      return NextResponse.json({ error: "You are already checked in." }, { status: 409 });
    }

    const { error } = await context.supabase.from("attendance").insert({
      organization_id: context.profile.organization_id,
      user_id: context.profile.id,
      check_in_latitude: parsed.data.coordinates.latitude,
      check_in_longitude: parsed.data.coordinates.longitude,
      notes: parsed.data.notes || null,
      selfie_storage_path: parsed.data.selfieStoragePath || null,
      status: "present",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    if (!openAttendance) {
      return NextResponse.json({ error: "Check in before recording a check-out." }, { status: 409 });
    }

    const { error } = await context.supabase
      .from("attendance")
      .update({
        check_out_time: new Date().toISOString(),
        check_out_latitude: parsed.data.coordinates.latitude,
        check_out_longitude: parsed.data.coordinates.longitude,
        notes: parsed.data.notes || null,
        ...(parsed.data.selfieStoragePath ? { selfie_storage_path: parsed.data.selfieStoragePath } : {}),
      })
      .eq("id", openAttendance.id)
      .eq("organization_id", context.profile.organization_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  await context.supabase.from("activities").insert({
    organization_id: context.profile.organization_id,
    actor_id: context.profile.id,
    activity_type: parsed.data.action === "check-in" ? "attendance_checked_in" : "attendance_checked_out",
    description: `${context.profile.full_name} ${parsed.data.action === "check-in" ? "checked in" : "checked out"}`,
    metadata: { coordinates: parsed.data.coordinates },
  });

  return NextResponse.json({ status: parsed.data.action === "check-in" ? "checked-in" : "checked-out" });
}

function getInitials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatRole(role: string) {
  return role.split("_").map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(value));
}

function formatTime(value?: string | null) {
  return value ? new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(value)) : undefined;
}

function getAttendanceLocation(attendance: {
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
}) {
  const latitude = attendance.check_out_latitude ?? attendance.check_in_latitude;
  const longitude = attendance.check_out_longitude ?? attendance.check_in_longitude;

  return latitude !== null && longitude !== null ? `GPS ${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}` : undefined;
}
