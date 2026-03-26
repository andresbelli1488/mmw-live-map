export type Genre =
  | "Tech House"
  | "Progressive House"
  | "House"
  | "Bass / DnB"
  | "Deep House"
  | "Underground"
  | "Afterhours";

export type EventRecord = {
  id: string;
  slug: string;
  title: string;
  venue: string;
  area: string;
  day: string;
  startAt: string;
  endAt: string;
  timeLabel: string;
  activeNow: boolean;
  trending: boolean;
  underground: boolean;
  genres: Genre[];
  ticketUrl: string;
  locationHint: string;
  coordinates: { x: number; y: number };
  lineup: string[];
  setTimes: { time: string; artist: string }[];
  promoCode: string | null;
  insiderNote: string | null;
  price: string | null;
  updatedAt: string;
  source: {
    provider: string;
    sourceUrl?: string;
    sourceId?: string;
    confidence?: number;
  };
};

export type LeadRecord = {
  id: string;
  email: string;
  source: string;
  eventId?: string | null;
  createdAt: string;
};

export type PulseItem = {
  id: string;
  text: string;
  urgency: "breaking" | "headsup" | "vibecheck";
  createdAt: string;
};

export type SyncStateRecord = {
  id: string;
  environment: string;
  gitBranch: string;
  gitCommit: string;
  remoteUrl: string;
  appBaseUrl: string | null;
  status: "healthy" | "degraded" | "unknown";
  generatedAt: string;
  notes: string | null;
};

export type ArtistRecord = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
};

export type ArtistEventLink = {
  id: string;
  artistId: string;
  eventId: string;
  role: "headliner" | "support" | "b2b" | "special_guest" | "unknown";
  confidence: number;
  createdAt: string;
};

export type UndergroundConnection = {
  artistName: string;
  sourceEventId: string;
  sourceEventTitle: string;
  relatedEventId: string;
  relatedEventTitle: string;
  venue: string;
  day: string;
  weight: number;
  reason: string;
};

export type EventAdminOverride = {
  promoCode?: string | null;
  setTimes?: { time: string; artist: string }[];
  underground?: boolean;
  locationHint?: string;
  insiderNote?: string | null;
  price?: string | null;
};

export type EventFilters = {
  day?: string;
  genre?: string;
  liveOnly?: boolean;
  undergroundOnly?: boolean;
  query?: string;
};

export type IngestedSourceEvent = {
  externalId: string;
  title: string;
  venue: string;
  area?: string;
  startAt?: string;
  endAt?: string;
  day?: string;
  ticketUrl?: string;
  lineup?: string[];
  genres?: string[];
  setTimes?: { time: string; artist: string }[];
  promoCode?: string | null;
  insiderNote?: string | null;
  price?: string | null;
  sourceUrl?: string;
  provider: string;
  underground?: boolean;
  trending?: boolean;
};
