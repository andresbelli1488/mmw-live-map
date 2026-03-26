import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nowIso, uid } from "@/lib/utils-core";
import type { PulseItem } from "@/lib/types";

const URGENCY_SET = new Set<PulseItem["urgency"]>(["breaking", "headsup", "vibecheck"]);

function sanitizeText(input: string) {
  return input.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export async function POST(request: Request) {
  const requiredKey = process.env.INGEST_ADMIN_KEY;
  if (requiredKey) {
    const provided = request.headers.get("x-ingest-key") || "";
    if (provided !== requiredKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => ({}));
  const text = sanitizeText(String(body.text ?? ""));
  const urgency = String(body.urgency ?? "") as PulseItem["urgency"];

  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  if (text.length > 500) {
    return NextResponse.json({ error: "text too long" }, { status: 400 });
  }

  if (!URGENCY_SET.has(urgency)) {
    return NextResponse.json({ error: "invalid urgency" }, { status: 400 });
  }

  const item = await db.createPulseItem({
    id: uid("pulse"),
    text,
    urgency,
    createdAt: nowIso(),
  });

  return NextResponse.json({ ok: true, item }, { status: 201 });
}
