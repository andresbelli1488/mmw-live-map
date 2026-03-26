import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runIngestionJob } from "@/lib/ingestion/run-ingestion";
import {
  StaticSeedProvider,
  ResidentAdvisorProvider,
  DiceProvider,
  EventbriteProvider,
  ShotgunProvider,
} from "@/lib/ingestion/providers";

export async function POST(request: Request) {
  const requiredKey = process.env.INGEST_ADMIN_KEY;
  if (requiredKey) {
    const provided = request.headers.get("x-ingest-key") || "";
    if (provided !== requiredKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => ({}));
  const includeSeed = body?.includeSeed !== false;

  const [raEventUrls, shotgunEventUrls] = await Promise.all([
    db.getProviderEventUrls("resident-advisor").catch(() => []),
    db.getProviderEventUrls("shotgun").catch(() => []),
  ]);

  const providers = [
    ...(includeSeed ? [new StaticSeedProvider()] : []),
    new ResidentAdvisorProvider({ eventUrls: raEventUrls }),
    new DiceProvider(),
    new EventbriteProvider(),
    new ShotgunProvider({ eventUrls: shotgunEventUrls }),
  ];

  const result = await runIngestionJob(providers);

  await Promise.all([
    db.touchProviderSources("resident-advisor").catch(() => undefined),
    db.touchProviderSources("shotgun").catch(() => undefined),
  ]);

  return NextResponse.json(result);
}
