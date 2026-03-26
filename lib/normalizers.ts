import type { EventRecord, Genre, IngestedSourceEvent } from "@/lib/types";
import { dedupe, nowIso, slugify, titleCaseArea } from "@/lib/utils-core";
import {
  inferArea,
  inferCoordinates,
  inferGenres,
  inferTrending,
  inferUnderground,
  makeDayLabel,
  makeTimeLabel,
  isActiveNow,
  normalizeArtistName,
} from "@/lib/event-helpers";

export function normalizeSourceEvent(input: IngestedSourceEvent): EventRecord {
  const area = titleCaseArea(input.area || inferArea(input.venue));
  const coordinates = inferCoordinates(area);
  const lineup = dedupe((input.lineup ?? []).map(normalizeArtistName));
  const genres = dedupe(
    ((input.genres ?? []).filter(Boolean) as Genre[]).length
      ? (input.genres as Genre[])
      : inferGenres(input.title, lineup)
  );
  const underground = typeof input.underground === "boolean" ? input.underground : inferUnderground(input.title, input.venue, lineup);
  const trending = typeof input.trending === "boolean" ? input.trending : inferTrending(lineup);
  const day = input.day ?? makeDayLabel(input.startAt);
  const startAt = input.startAt ?? new Date().toISOString();
  const endAt = input.endAt ?? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

  return {
    id: `${input.provider}_${slugify(input.externalId || `${input.venue}-${input.title}`)}`,
    slug: slugify(`${input.title}-${input.venue}`),
    title: input.title,
    venue: input.venue,
    area,
    day,
    startAt,
    endAt,
    timeLabel: makeTimeLabel(startAt, endAt),
    activeNow: isActiveNow(startAt, endAt),
    trending,
    underground,
    genres,
    ticketUrl: input.ticketUrl || input.sourceUrl || "#",
    locationHint: underground ? `${area} District` : area,
    coordinates,
    lineup,
    setTimes: input.setTimes ?? [],
    promoCode: input.promoCode ?? null,
    insiderNote: input.insiderNote ?? null,
    price: input.price ?? null,
    updatedAt: nowIso(),
    source: {
      provider: input.provider,
      sourceUrl: input.sourceUrl,
      sourceId: input.externalId,
      confidence: 0.8,
    },
  };
}
