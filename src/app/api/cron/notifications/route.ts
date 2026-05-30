import { NextResponse } from "next/server";
import { dispatchScheduledNotifications } from "@/services/scheduled-notification-service";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await dispatchScheduledNotifications());
  } catch (error) {
    console.error("Scheduled notification dispatch failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Notification dispatch failed" }, { status: 500 });
  }
}
