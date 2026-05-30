"use client";

import type { WorkspaceIdentity } from "@/lib/auth-types";
import type { AttendanceHistoryRecord, AttendanceRecord } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export interface AttendanceCoordinates {
  latitude: number;
  longitude: number;
}

export type AttendanceAction = "check-in" | "check-out";

export interface AttendanceSnapshot {
  records: AttendanceRecord[];
  history: AttendanceHistoryRecord[];
}

export function captureAttendance(coordinates: AttendanceCoordinates) {
  if (Math.abs(coordinates.latitude) > 90 || Math.abs(coordinates.longitude) > 180) {
    throw new Error("Invalid attendance coordinates");
  }

  return {
    coordinates,
    capturedAt: new Date().toISOString(),
  };
}

export function requestAttendanceCoordinates() {
  return new Promise<AttendanceCoordinates>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser does not support location capture."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(captureAttendance({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }).coordinates),
      () => reject(new Error("Allow location access to record attendance.")),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

export function formatAttendanceLocation(coordinates: AttendanceCoordinates) {
  return `GPS ${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`;
}

export async function getOrganizationAttendance(identity: WorkspaceIdentity) {
  if (identity.isDemo) {
    throw new Error("Demo attendance is stored locally.");
  }

  return requestAttendanceApi<AttendanceSnapshot>("GET");
}

export async function recordOrganizationAttendance(
  identity: WorkspaceIdentity,
  action: AttendanceAction,
  coordinates: AttendanceCoordinates,
  notes: string,
  selfieStoragePath?: string,
) {
  if (identity.isDemo) {
    return { status: "simulated" };
  }

  return requestAttendanceApi<{ status: string }>("POST", {
    action,
    coordinates,
    notes,
    selfieStoragePath,
  });
}

export async function uploadAttendanceSelfie(identity: WorkspaceIdentity, file: File) {
  if (identity.isDemo) {
    return `demo/${file.name}`;
  }

  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase browser client is not configured");
  }

  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${identity.organizationId}/${identity.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("attendance-media").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return path;
}

async function requestAttendanceApi<T>(method: "GET" | "POST", body?: Record<string, unknown>) {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Your session expired. Sign in again.");
  }

  const response = await fetch("/api/attendance", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json() as T & { error?: string };

  if (!response.ok) {
    throw new Error(result.error ?? "Unable to update attendance");
  }

  return result;
}
