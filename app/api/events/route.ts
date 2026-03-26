import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nowIso } from "@/lib/utils-core";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const filters = {
    day: query.get("day") || undefined,
    genre: query.get("genre") || undefined,
    liveOnly: query.get("liveOnly") === "true",
    undergroundOnly: query.get("undergroundOnly") === "true",
    query: query.get("query") || undefined,
  };

  const events = await db.getEvents(filters);
  const allEvents = await db.getAllEvents();
  const dayCountMap = new Map<string, number>();

  for (const event of allEvents) {
    dayCountMap.set(event.day, (dayCountMap.get(event.day) ?? 0) + 1);
  }

  const days = [...dayCountMap.entries()].map(([key, count]) => ({ key, events: count }));

  return NextResponse.json({ events, days, generatedAt: nowIso() });
}
