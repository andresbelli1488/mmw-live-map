import type { Genre } from "@/lib/types";
import { dedupe } from "@/lib/utils-core";

export function inferArea(venue: string): string {
  const v = venue.toLowerCase();
  if (v.includes("space") || v.includes("epic")) return "Downtown";
  if (v.includes("factory town")) return "Hialeah";
  if (v.includes("do not sit") || v.includes("surfcomber") || v.includes("sagamore")) return "Miami Beach";
  if (v.includes("wynwood") || v.includes("secret lot") || v.includes("jolene")) return "Wynwood";
  return "Miami";
}

export function inferCoordinates(area: string): { x: number; y: number } {
  switch (area.toLowerCase()) {
    case "downtown":
      return { x: 55, y: 66 };
    case "wynwood":
      return { x: 46, y: 35 };
    case "miami beach":
      return { x: 81, y: 41 };
    case "hialeah":
      return { x: 30, y: 47 };
    default:
      return { x: 52, y: 50 };
  }
}

export function inferGenres(title: string, lineup: string[] = []): Genre[] {
  const hay = `${title} ${lineup.join(" ")}`.toLowerCase();
  const genres: Genre[] = [];

  if (hay.includes("progressive")) genres.push("Progressive House");
  if (hay.includes("bass") || hay.includes("dnb") || hay.includes("drum and bass")) genres.push("Bass / DnB");
  if (hay.includes("deep")) genres.push("Deep House");
  if (hay.includes("after") || hay.includes("sunrise") || hay.includes("space")) genres.push("Afterhours");
  if (hay.includes("warehouse") || hay.includes("underground") || hay.includes("secret")) genres.push("Underground");

  if (!genres.length) genres.push("House");
  return dedupe(genres);
}

export function inferUnderground(title: string, venue: string, lineup: string[] = []): boolean {
  const hay = `${title} ${venue} ${lineup.join(" ")}`.toLowerCase();
  return ["warehouse", "secret", "underground", "afterhours", "do not sit", "floyd", "ground"].some((token) =>
    hay.includes(token)
  );
}

export function inferTrending(lineup: string[] = []): boolean {
  const bigNames = ["john summit", "martin garrix", "patrick topping", "ricardo villalobos", "michael bibi"];
  const hay = lineup.join(" ").toLowerCase();
  return bigNames.some((name) => hay.includes(name));
}

export function makeTimeLabel(startAt?: string, endAt?: string): string {
  if (!startAt || !endAt) return "Time TBA";
  const start = new Date(startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const end = new Date(endAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${start} — ${end}`;
}

export function makeDayLabel(startAt?: string, fallback?: string): string {
  if (!startAt) return fallback ?? "TBA";
  const d = new Date(startAt);
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const day = d.getDate();
  return `${weekday} ${day}`;
}

export function isActiveNow(startAt?: string, endAt?: string) {
  if (!startAt || !endAt) return false;
  const now = Date.now();
  return now >= new Date(startAt).getTime() && now <= new Date(endAt).getTime();
}

export function normalizeArtistName(name: string): string {
  return name.trim().replace(/\s+b2b\s+/gi, " b2b ").replace(/\s+/g, " ");
}

export function splitArtists(lineup: string[]): string[] {
  const out: string[] = [];
  for (const entry of lineup) {
    const parts = entry.split(/,|\/|&| b2b /i).map((v) => normalizeArtistName(v)).filter(Boolean);
    out.push(...parts);
  }
  return dedupe(out);
}
