import rawEvents from "@/lib/data/mmw-events-raw.json";
import type { Genre, IngestedSourceEvent } from "@/lib/types";
import { slugify } from "@/lib/utils-core";

type DayKey = "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

type RawEvent = {
  n: string;
  v: string;
  d: DayKey;
  t: string;
  g?: string;
  a?: string;
  hi?: number;
  ug?: number;
  tk?: string;
};

const DAY_ISO: Record<DayKey, string> = {
  tue: "2026-03-24",
  wed: "2026-03-25",
  thu: "2026-03-26",
  fri: "2026-03-27",
  sat: "2026-03-28",
  sun: "2026-03-29",
};

function toGenre(input?: string): Genre {
  switch ((input ?? "").toLowerCase()) {
    case "tech house":
      return "Tech House";
    case "progressive":
    case "progressive house":
      return "Progressive House";
    case "house":
      return "House";
    case "bass/dnb":
    case "bass / dnb":
      return "Bass / DnB";
    case "deep house":
      return "Deep House";
    case "underground":
      return "Underground";
    case "afterhours":
      return "Afterhours";
    default:
      return "House";
  }
}

function parseClockTo24(part: string, fallbackMeridiem?: "AM" | "PM"): { h: number; m: number; meridiem: "AM" | "PM" } | null {
  const clean = part.trim().toUpperCase();
  const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return null;

  const rawHour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const meridiem = (match[3] as "AM" | "PM" | undefined) ?? fallbackMeridiem ?? "PM";

  let hour = rawHour % 12;
  if (meridiem === "PM") hour += 12;

  return { h: hour, m: minute, meridiem };
}

function withOffset(dateIso: string, h: number, m: number): string {
  return `${dateIso}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-04:00`;
}

function addHours(iso: string, hours: number): string {
  const d = new Date(iso);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

function parseTimeRange(day: DayKey, timeLabel: string): { startAt: string; endAt: string } {
  const dayIso = DAY_ISO[day];
  const label = timeLabel.trim();

  if (label.toLowerCase() === "all day") {
    return {
      startAt: withOffset(dayIso, 12, 0),
      endAt: withOffset(dayIso, 23, 0),
    };
  }

  if (label.toLowerCase() === "late") {
    const startAt = withOffset(dayIso, 23, 0);
    return { startAt, endAt: addHours(startAt, 5) };
  }

  const normalized = label.replace(/[\u2192]/g, "->").replace(/[\u2013]/g, "-");

  if (normalized.includes("->") && !normalized.includes("-")) {
    const left = normalized.split("->")[0]?.trim();
    const parsedStart = parseClockTo24(left || "11 PM", "PM");
    const startAt = withOffset(dayIso, parsedStart?.h ?? 23, parsedStart?.m ?? 0);
    return { startAt, endAt: addHours(startAt, 10) };
  }

  const rangeMatch = normalized.match(/^(.+?)\s*-\s*(.+)$/);
  if (rangeMatch) {
    const rightRaw = rangeMatch[2].trim().toUpperCase();
    const rightMeridiem = rightRaw.includes("AM") ? "AM" : rightRaw.includes("PM") ? "PM" : undefined;

    const left = parseClockTo24(rangeMatch[1], rightMeridiem);
    const right = parseClockTo24(rangeMatch[2], rightMeridiem);

    if (left && right) {
      const startAt = withOffset(dayIso, left.h, left.m);
      let endAt = withOffset(dayIso, right.h, right.m);
      if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
        endAt = addHours(endAt, 24);
      }
      return { startAt, endAt };
    }
  }

  const single = parseClockTo24(label, "PM");
  if (single) {
    const startAt = withOffset(dayIso, single.h, single.m);
    return { startAt, endAt: addHours(startAt, 4) };
  }

  const fallbackStart = withOffset(dayIso, 21, 0);
  return { startAt: fallbackStart, endAt: addHours(fallbackStart, 5) };
}

function splitLineup(lineupRaw?: string): string[] {
  if (!lineupRaw) return [];
  return lineupRaw
    .split("·")
    .map((v) => v.trim())
    .filter(Boolean);
}

const typedRaw = rawEvents as RawEvent[];

export const MMW_EVENTS_2026: IngestedSourceEvent[] = typedRaw.map((event) => {
  const { startAt, endAt } = parseTimeRange(event.d, event.t);

  return {
    externalId: slugify(`${event.n}-${event.v}-${event.d}`),
    title: event.n,
    venue: event.v,
    day: event.d,
    startAt,
    endAt,
    ticketUrl: event.tk,
    lineup: splitLineup(event.a),
    genres: [toGenre(event.g)],
    provider: "seed",
    underground: Boolean(event.ug),
    trending: Boolean(event.hi),
  };
});
