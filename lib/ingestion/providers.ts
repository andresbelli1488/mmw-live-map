import type { IngestedSourceEvent } from "@/lib/types";
import { ResidentAdvisorLiveProvider } from "@/lib/ingestion/ra-provider";
import { ShotgunLiveProvider } from "@/lib/ingestion/shotgun-provider";
import { MMW_EVENTS_2026 } from "@/lib/data/mmw-events-2026";

export interface IngestionProvider {
  name: string;
  fetchEvents(): Promise<IngestedSourceEvent[]>;
}

type JsonRecord = Record<string, unknown>;

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

function asBool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
  return out.length ? out : undefined;
}

function mapJsonToIngested(provider: string, record: JsonRecord): IngestedSourceEvent | null {
  const title = asString(record.title) ?? asString(record.name);
  const venue = asString(record.venue);
  const externalId = asString(record.externalId) ?? asString(record.id) ?? `${provider}-${title ?? "event"}`;
  if (!title || !venue) return null;

  return {
    externalId,
    title,
    venue,
    area: asString(record.area),
    startAt: asString(record.startAt) ?? asString(record.start_at),
    endAt: asString(record.endAt) ?? asString(record.end_at),
    day: asString(record.day),
    ticketUrl: asString(record.ticketUrl) ?? asString(record.ticket_url),
    lineup: asStringArray(record.lineup),
    genres: asStringArray(record.genres),
    setTimes: Array.isArray(record.setTimes) ? (record.setTimes as { time: string; artist: string }[]) : undefined,
    promoCode: asString(record.promoCode),
    insiderNote: asString(record.insiderNote),
    price: asString(record.price),
    sourceUrl: asString(record.sourceUrl) ?? asString(record.url),
    provider,
    underground: asBool(record.underground),
    trending: asBool(record.trending),
  };
}

class JsonFeedProvider implements IngestionProvider {
  constructor(public name: string, private envVarName: string) {}

  async fetchEvents(): Promise<IngestedSourceEvent[]> {
    const url = process.env[this.envVarName];
    if (!url) return [];

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) return [];
    const payload: unknown = await res.json().catch(() => []);
    if (!Array.isArray(payload)) return [];

    return payload
      .map((item) => mapJsonToIngested(this.name, item as JsonRecord))
      .filter((item): item is IngestedSourceEvent => !!item);
  }
}

export class StaticSeedProvider implements IngestionProvider {
  name = "seed";

  async fetchEvents(): Promise<IngestedSourceEvent[]> {
    return MMW_EVENTS_2026;
  }
}

export class ResidentAdvisorProvider implements IngestionProvider {
  name = "resident-advisor";

  constructor(private config?: {
    eventUrls?: string[];
    curatedFeedUrl?: string;
    citySlug?: string;
    weekKeyword?: string;
  }) {}

  async fetchEvents(): Promise<IngestedSourceEvent[]> {
    // Primary: Use real RA Live provider with multi-layer strategy
    const provider = new ResidentAdvisorLiveProvider({
      eventUrls: this.config?.eventUrls,
      curatedFeedUrl: this.config?.curatedFeedUrl ?? process.env.RA_FEED_URL,
      citySlug: this.config?.citySlug ?? "miami",
      weekKeyword: this.config?.weekKeyword ?? "Miami Music Week 2026",
    });
    return provider.fetchEvents();
  }
}

export class DiceProvider implements IngestionProvider {
  name = "dice";
  async fetchEvents(): Promise<IngestedSourceEvent[]> {
    return new JsonFeedProvider(this.name, "DICE_FEED_URL").fetchEvents();
  }
}

export class EventbriteProvider implements IngestionProvider {
  name = "eventbrite";
  async fetchEvents(): Promise<IngestedSourceEvent[]> {
    return new JsonFeedProvider(this.name, "EVENTBRITE_FEED_URL").fetchEvents();
  }
}

export class ShotgunProvider implements IngestionProvider {
  name = "shotgun";

  constructor(private config?: {
    eventUrls?: string[];
    curatedFeedUrl?: string;
    cityKeyword?: string;
    weekKeyword?: string;
  }) {}

  async fetchEvents(): Promise<IngestedSourceEvent[]> {
    // Use real Shotgun Live provider with multi-layer strategy
    const provider = new ShotgunLiveProvider({
      eventUrls: this.config?.eventUrls,
      curatedFeedUrl: this.config?.curatedFeedUrl ?? process.env.SHOTGUN_FEED_URL,
      cityKeyword: this.config?.cityKeyword ?? "Miami",
      weekKeyword: this.config?.weekKeyword ?? "Miami Music Week 2026",
      defaultUnderground: true,
    });
    return provider.fetchEvents();
  }
}

// Re-export for explicit access to the three-layer live providers
export { ResidentAdvisorLiveProvider, ShotgunLiveProvider };
