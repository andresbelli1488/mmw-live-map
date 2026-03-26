import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nowIso, uid } from "@/lib/utils-core";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").toLowerCase().trim();
  const source = String(body.source ?? "").trim();
  const eventId = body.eventId ? String(body.eventId).trim() : null;

  if (!email || !source) {
    return NextResponse.json({ error: "email and source are required" }, { status: 400 });
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  if (source.length > 50) {
    return NextResponse.json({ error: "source too long" }, { status: 400 });
  }

  if (eventId) {
    const event = await db.getEventById(eventId);
    if (!event) {
      return NextResponse.json({ error: "event not found" }, { status: 404 });
    }
  }

  const lead = await db.saveLead({
    id: uid("lead"),
    email,
    source,
    eventId,
    createdAt: nowIso(),
  });

  return NextResponse.json({ ok: true, lead }, { status: 201 });
}
