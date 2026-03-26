import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  if (!body.email) {
    return NextResponse.json({ ok: true, saved: false });
  }

  await db.saveEventForEmail(String(body.email).toLowerCase().trim(), id);
  return NextResponse.json({ ok: true, saved: true });
}
