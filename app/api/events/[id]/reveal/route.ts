import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nowIso, uid } from "@/lib/utils-core";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  if (body.email) {
    await db.saveLead({
      id: uid("lead"),
      email: String(body.email).toLowerCase().trim(),
      source: "promo_reveal",
      eventId: id,
      createdAt: nowIso(),
    });
  }

  const promoCode = await db.revealPromo(id);
  return NextResponse.json({ promoCode });
}
