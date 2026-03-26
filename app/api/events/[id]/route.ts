import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUndergroundLayerForEvent } from "@/lib/underground-graph";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await db.getEventById(id);

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const undergroundLayer = await getUndergroundLayerForEvent(id, db);
  return NextResponse.json({ event, undergroundLayer });
}
