import type { IngestedSourceEvent } from "@/lib/types";
import { slugify } from "@/lib/utils-core";

export interface IngestionProvider {
  name: string;
  fetchEvents(): Promise<IngestedSourceEvent[]>;
}

type ShotgunProviderConfig = {
  cityKeyword?: string;
  weekKeyword?: string;
  eventUrls?: string[];
  curatedFeedUrl?: string;
  requestTimeoutMs?: number;
  maxEvents?: number;
  defaultUnderground?: boolean;
};

type ShotgunPagePayload = {
  id?: string;
  title?: string;
  venue?: string;
  area?: string;
  startAt?: string;
  endAt?: string;
  ticketUrl?: string;
  lineup?: string[];
  setTimes?: { time: string; artist: string }[];
  price?: string | null;
  sourceUrl: string;
  underground?: boolean;
};

type JsonLdObject = Record<string, unknown>;

const DEFAULT_TIMEOUT = 12000;

function absoluteUrl(url: string, base = "https://shotgun.live") {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function findAllMatches(input: string, regex: RegExp): string[] {
  const out: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : `${regex.flags}g`);
  while ((match = re.exec(input)) !== null) {
    if (match[1]) out.push(match[1]);
  }
  return uniq(out);
}

function textBetween(input: string, start: string, end: string): string | null {
  const s = input.indexOf(start);
  if (s === -1) return null;
  const from = s + start.length;
  const e = input.indexOf(end, from);
  if (e === -1) return null;
  return input.slice(from, e);
}

function maybeDayLabel(dateString?: string): string | undefined {
  if (!dateString) return undefined;
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${d.getDate()}`;
}

function inferAreaFromVenue(venue?: string): string | undefined {
  if (!venue) return undefined;
  const v = venue.toLowerCase();
  if (v.includes("space") || v.includes("epic")) return "Downtown";
  if (v.includes("factory town")) return "Hialeah";
  if (v.includes("do not sit") || v.includes("surfcomber") || v.includes("sagamore") || v.includes("beach"))
    return "Miami Beach";
  if (v.includes("wynwood") || v.includes("jolene") || v.includes("lot") || v.includes("warehouse") || v.includes("secret"))
    return "Wynwood";
  return undefined;
}

function inferUndergroundSignal(title?: string, venue?: string, lineup: string[] = []): boolean {
  const hay = `${title || ""} ${venue || ""} ${lineup.join(" ")}`.toLowerCase();
  return [
    "warehouse",
    "afterhours",
    "secret",
    "off-grid",
    "underground",
    "sunrise",
    "lot",
    "invite only",
    "community",
  ].some((token) => hay.includes(token));
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 MMWLiveMap/1.0",
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Shotgun request failed ${response.status} for ${url}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function extractJsonLdObjects(html: string): JsonLdObject[] {
  const rawScripts = findAllMatches(
    html,
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  const results: JsonLdObject[] = [];
  for (const raw of rawScripts) {
    try {
      const parsed = JSON.parse(raw.trim()) as unknown;
      if (Array.isArray(parsed)) results.push(...(parsed as JsonLdObject[]));
      else results.push(parsed as JsonLdObject);
    } catch {
      // ignore malformed blocks
    }
  }
  return results;
}

function extractCandidateTitle(html: string): string | undefined {
  const og = textBetween(html, '<meta property="og:title" content="', '"');
  if (og) return stripHtml(og);
  const title = textBetween(html, "<title>", "</title>");
  return title ? stripHtml(title.replace(/\|.*$/, "").trim()) : undefined;
}

function extractCandidateVenue(html: string): string | undefined {
  const patterns = [
    /"location"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i,
    /"venue"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i,
    /"place"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i,
    />\s*Venue\s*<[^>]*>\s*<[^>]*>\s*([^<]+)\s*</i,
  ];
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m?.[1]) return stripHtml(m[1]);
  }
  return undefined;
}

function extractDateTimes(html: string): { startAt?: string; endAt?: string } {
  const startPatterns = [
    /"startDate"\s*:\s*"([^"]+)"/i,
    /"startsAt"\s*:\s*"([^"]+)"/i,
    /"start"\s*:\s*"([^"]+)"/i,
  ];
  const endPatterns = [
    /"endDate"\s*:\s*"([^"]+)"/i,
    /"endsAt"\s*:\s*"([^"]+)"/i,
    /"end"\s*:\s*"([^"]+)"/i,
  ];

  let startAt: string | undefined;
  let endAt: string | undefined;

  for (const p of startPatterns) {
    const m = html.match(p);
    if (m?.[1]) {
      startAt = m[1];
      break;
    }
  }
  for (const p of endPatterns) {
    const m = html.match(p);
    if (m?.[1]) {
      endAt = m[1];
      break;
    }
  }

  return { startAt, endAt };
}

function extractLineup(html: string): string[] {
  const names = new Set<string>();

  const jsonLd = extractJsonLdObjects(html);
  for (const obj of jsonLd) {
    const performers = obj?.performer;
    if (Array.isArray(performers)) {
      for (const p of performers) {
        const perfObj = p as Record<string, unknown>;
        if (typeof perfObj?.name === "string") names.add(stripHtml(perfObj.name));
      }
    } else if (typeof (performers as Record<string, unknown>)?.name === "string") {
      names.add(stripHtml((performers as Record<string, unknown>).name as string));
    }
  }

  const metaBlocks = [
    ...findAllMatches(html, /"artists"\s*:\s*\[([^\]]+)\]/gi),
    ...findAllMatches(html, /"lineup"\s*:\s*\[([^\]]+)\]/gi),
  ];

  for (const block of metaBlocks) {
    const inner = findAllMatches(block, /"name"\s*:\s*"([^"]+)"/gi);
    inner.forEach((n) => names.add(stripHtml(n)));
  }

  return [...names].filter(Boolean);
}

function extractTicketUrl(html: string, sourceUrl: string): string | undefined {
  const candidates = [
    textBetween(html, '<meta property="og:url" content="', '"') || undefined,
    ...findAllMatches(html, /href=["']([^"']*(?:ticket|tickets|rsvp|checkout|buy)[^"']*)["']/gi),
  ].filter(Boolean) as string[];

  if (!candidates.length) return sourceUrl;
  return absoluteUrl(candidates[0], sourceUrl);
}

function extractPrice(html: string): string | null {
  const pricePatterns = [
    /"price"\s*:\s*"([^"]+)"/i,
    /([£$€]\s?\d+[\d.,]*)/i,
    /from\s+([£$€]\s?\d+[\d.,]*)/i,
  ];
  for (const p of pricePatterns) {
    const m = html.match(p);
    if (m?.[1]) return stripHtml(m[1]);
  }
  return null;
}

function extractSetTimes(html: string): { time: string; artist: string }[] {
  const text = stripHtml(html);
  const lines = text.split(/\s{2,}|\|/).map((s) => s.trim()).filter(Boolean);
  const results: { time: string; artist: string }[] = [];

  for (const line of lines) {
    const match = line.match(/(\d{1,2}[:.]\d{2}\s?(?:AM|PM|am|pm)?)[\s\-–—]+(.+)/);
    if (match) {
      results.push({ time: match[1].replace(".", ":"), artist: match[2].trim() });
    }
  }

  return results.slice(0, 20);
}

function parseShotgunEventPage(
  html: string,
  sourceUrl: string,
  defaultUnderground = true
): ShotgunPagePayload {
  const jsonLd = extractJsonLdObjects(html);
  const eventLd = jsonLd.find((obj) => {
    const t = obj["@type"];
    return t === "Event" || (Array.isArray(t) && (t as string[]).includes("Event"));
  });

  const title =
    (eventLd?.name as string | undefined) || extractCandidateTitle(html) || undefined;
  const venue =
    ((eventLd?.location as Record<string, unknown>)?.name as string | undefined) ||
    extractCandidateVenue(html) ||
    undefined;
  const dt = extractDateTimes(html);
  const lineup = extractLineup(html);
  const setTimes = extractSetTimes(html);
  const ticketUrl = extractTicketUrl(html, sourceUrl);
  const price = extractPrice(html);
  const underground = defaultUnderground || inferUndergroundSignal(title, venue, lineup);

  return {
    id:
      (eventLd?.identifier as string | undefined) ||
      slugify(`${title || "event"}-${venue || "venue"}`),
    title,
    venue,
    area: inferAreaFromVenue(venue),
    startAt: (eventLd?.startDate as string | undefined) || dt.startAt,
    endAt: (eventLd?.endDate as string | undefined) || dt.endAt,
    ticketUrl,
    lineup,
    setTimes,
    price,
    sourceUrl,
    underground,
  };
}

function toIngestedEvent(payload: ShotgunPagePayload): IngestedSourceEvent | null {
  if (!payload.title || !payload.venue) return null;

  return {
    externalId:
      payload.id || slugify(`${payload.title}-${payload.venue}`),
    title: payload.title,
    venue: payload.venue,
    area: payload.area,
    startAt: payload.startAt,
    endAt: payload.endAt,
    day: maybeDayLabel(payload.startAt),
    ticketUrl: payload.ticketUrl,
    lineup: payload.lineup,
    setTimes: payload.setTimes,
    price: payload.price,
    sourceUrl: payload.sourceUrl,
    provider: "shotgun",
    underground: payload.underground ?? true,
    trending: false,
  };
}

async function fetchCuratedFeed(
  curatedFeedUrl: string,
  timeoutMs: number
): Promise<IngestedSourceEvent[]> {
  const raw = await fetchWithTimeout(curatedFeedUrl, timeoutMs);
  const json = JSON.parse(raw) as IngestedSourceEvent[];
  return Array.isArray(json) ? json : [];
}

async function fetchKnownEventUrl(
  url: string,
  timeoutMs: number,
  defaultUnderground: boolean
): Promise<IngestedSourceEvent | null> {
  const html = await fetchWithTimeout(url, timeoutMs);
  const parsed = parseShotgunEventPage(html, url, defaultUnderground);
  return toIngestedEvent(parsed);
}

async function discoverCandidateUrls(
  cityKeyword: string,
  weekKeyword: string,
  timeoutMs: number,
  maxEvents: number
): Promise<string[]> {
  const searchUrl = `https://shotgun.live/events?search=${encodeURIComponent(
    `${cityKeyword} ${weekKeyword}`
  )}`;
  const html = await fetchWithTimeout(searchUrl, timeoutMs);

  const paths = findAllMatches(html, /href=["']([^"']*\/events\/[^"']+)["']/gi).map((p) =>
    absoluteUrl(p, "https://shotgun.live")
  );

  return uniq(paths).slice(0, maxEvents);
}

export class ShotgunLiveProvider implements IngestionProvider {
  name = "shotgun";
  private config: Required<ShotgunProviderConfig>;

  constructor(config: ShotgunProviderConfig = {}) {
    this.config = {
      cityKeyword: config.cityKeyword ?? "Miami",
      weekKeyword: config.weekKeyword ?? "Miami Music Week 2026",
      eventUrls: config.eventUrls ?? [],
      curatedFeedUrl: config.curatedFeedUrl ?? "",
      requestTimeoutMs: config.requestTimeoutMs ?? DEFAULT_TIMEOUT,
      maxEvents: config.maxEvents ?? 40,
      defaultUnderground: config.defaultUnderground ?? true,
    };
  }

  async fetchEvents(): Promise<IngestedSourceEvent[]> {
    if (this.config.curatedFeedUrl) {
      try {
        const curated = await fetchCuratedFeed(
          this.config.curatedFeedUrl,
          this.config.requestTimeoutMs
        );
        if (curated.length) {
          return curated.map((item) => ({
            ...item,
            provider: "shotgun",
            underground: item.underground ?? this.config.defaultUnderground,
          }));
        }
      } catch {
        // fall through
      }
    }

    let urls = [...this.config.eventUrls];

    if (!urls.length) {
      try {
        urls = await discoverCandidateUrls(
          this.config.cityKeyword,
          this.config.weekKeyword,
          this.config.requestTimeoutMs,
          this.config.maxEvents
        );
      } catch {
        // discovery failed, return empty
        return [];
      }
    }

    const results = await Promise.allSettled(
      urls.map((url) =>
        fetchKnownEventUrl(url, this.config.requestTimeoutMs, this.config.defaultUnderground)
      )
    );

    const events = results
      .filter((r): r is PromiseFulfilledResult<IngestedSourceEvent | null> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter((v): v is IngestedSourceEvent => Boolean(v));

    const deduped = new Map<string, IngestedSourceEvent>();
    for (const event of events) {
      deduped.set(event.externalId, event);
    }

    return [...deduped.values()];
  }
}
