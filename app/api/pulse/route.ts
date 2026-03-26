import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawLimit = Number(searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.floor(rawLimit))) : 50;

  const items = await db.getPulseItems(limit);
  return NextResponse.json({ items, count: items.length });
}
