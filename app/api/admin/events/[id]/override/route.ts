import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { EventAdminOverride } from "@/lib/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requiredKey = process.env.INGEST_ADMIN_KEY;
  if (requiredKey) {
    const provided = request.headers.get("x-ingest-key") || "";
    if (provided !== requiredKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as EventAdminOverride;

  const updated = await db.applyEventOverrides(id, {
    promoCode: body.promoCode,
    setTimes: body.setTimes,
    underground: body.underground,
    locationHint: body.locationHint,
    insiderNote: body.insiderNote,
    price: body.price,
  });

  if (!updated) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, event: updated });
}
