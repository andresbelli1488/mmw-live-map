import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { SyncStateRecord } from "@/lib/types";

export async function POST(request: Request) {
  const requiredKey = process.env.INGEST_ADMIN_KEY;
  if (requiredKey) {
    const provided = request.headers.get("x-ingest-key") || "";
    if (provided !== requiredKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { local, git, deploy, syncHealthy, generatedAt } = body as {
    local?: { branch?: string; commit?: string; workingTreeClean?: boolean };
    git?: { origin?: string; aheadBy?: number; behindBy?: number };
    deploy?: { baseUrl?: string | null };
    syncHealthy?: boolean;
    generatedAt?: string;
  };

  const id = `sync_${(generatedAt ?? new Date().toISOString()).replace(/[^0-9T]/g, "").slice(0, 15)}`;

  const record: SyncStateRecord = {
    id,
    environment: process.env.RENDER_SERVICE_NAME ?? process.env.NODE_ENV ?? "unknown",
    gitBranch: local?.branch ?? "unknown",
    gitCommit: local?.commit ?? "unknown",
    remoteUrl: git?.origin ?? "unknown",
    appBaseUrl: deploy?.baseUrl ?? null,
    status: syncHealthy === true ? "healthy" : syncHealthy === false ? "degraded" : "unknown",
    generatedAt: generatedAt ?? new Date().toISOString(),
    notes: [
      local?.workingTreeClean === false ? "dirty working tree" : null,
      (git?.aheadBy ?? 0) > 0 ? `ahead by ${git!.aheadBy}` : null,
      (git?.behindBy ?? 0) > 0 ? `behind by ${git!.behindBy}` : null,
    ]
      .filter(Boolean)
      .join("; ") || null,
  };

  const saved = await db.upsertSyncState(record);

  return NextResponse.json({ ok: true, record: saved });
}
