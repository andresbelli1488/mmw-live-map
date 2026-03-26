import MmwMap from "@/app/_components/mmw-map";
import { db } from "@/lib/db";
import { StaticSeedProvider } from "@/lib/ingestion/providers";
import { runIngestionJob } from "@/lib/ingestion/run-ingestion";

export default async function HomePage() {
  let events = await db.getEvents({});

  // Ensure a first-run local experience even before manual /api/bootstrap.
  if (events.length === 0) {
    await runIngestionJob([new StaticSeedProvider()], db);
    events = await db.getEvents({});
  }

  return <MmwMap initialEvents={events} />;
}