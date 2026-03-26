import { db, type DatabaseAdapter } from "@/lib/db";
import { normalizeSourceEvent } from "@/lib/normalizers";
import { buildArtistIndex, buildUndergroundConnections } from "@/lib/underground-graph";
import { nowIso } from "@/lib/utils-core";
import { IngestionProvider, StaticSeedProvider } from "@/lib/ingestion/providers";

export async function runIngestionJob(
  providers: IngestionProvider[] = [new StaticSeedProvider()],
  adapter: DatabaseAdapter = db
) {
  const batches = await Promise.all(providers.map((provider) => provider.fetchEvents()));
  const flat = batches.flat();

  for (const raw of flat) {
    await adapter.upsertEvent(normalizeSourceEvent(raw));
  }

  await buildArtistIndex(adapter);
  const undergroundConnections = await buildUndergroundConnections(adapter);

  return {
    ingested: flat.length,
    undergroundConnections: undergroundConnections.length,
    generatedAt: nowIso(),
  };
}
