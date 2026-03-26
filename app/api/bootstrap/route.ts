import { NextResponse } from "next/server";
import { runIngestionJob } from "@/lib/ingestion/run-ingestion";
import { StaticSeedProvider } from "@/lib/ingestion/providers";

export async function POST() {
  const result = await runIngestionJob([new StaticSeedProvider()]);
  return NextResponse.json(result);
}
