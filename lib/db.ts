import type {
  EventAdminOverride,
  ArtistEventLink,
  ArtistRecord,
  EventFilters,
  EventRecord,
  Genre,
  LeadRecord,
  PulseItem,
  SyncStateRecord,
} from "@/lib/types";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface DatabaseAdapter {
  getEvents(filters: EventFilters): Promise<EventRecord[]>;
  getEventById(id: string): Promise<EventRecord | null>;
  upsertEvent(event: EventRecord): Promise<EventRecord>;
  saveLead(lead: LeadRecord): Promise<LeadRecord>;
  saveEventForEmail(email: string, eventId: string): Promise<void>;
  revealPromo(eventId: string): Promise<string | null>;
  upsertArtist(artist: ArtistRecord): Promise<ArtistRecord>;
  getArtistBySlug(slug: string): Promise<ArtistRecord | null>;
  upsertArtistEventLink(link: ArtistEventLink): Promise<ArtistEventLink>;
  applyEventOverrides(eventId: string, overrides: EventAdminOverride): Promise<EventRecord | null>;
  getProviderEventUrls(providerName: string): Promise<string[]>;
  touchProviderSources(providerName: string): Promise<void>;
  getAllEvents(): Promise<EventRecord[]>;
  getAllArtists(): Promise<ArtistRecord[]>;
  getAllArtistEventLinks(): Promise<ArtistEventLink[]>;
  getPulseItems(limit?: number): Promise<PulseItem[]>;
  createPulseItem(item: PulseItem): Promise<PulseItem>;
  upsertSyncState(record: SyncStateRecord): Promise<SyncStateRecord>;
}

class InMemoryDatabase implements DatabaseAdapter {
  private events = new Map<string, EventRecord>();
  private leads = new Map<string, LeadRecord>();
  private artists = new Map<string, ArtistRecord>();
  private artistBySlug = new Map<string, string>();
  private links = new Map<string, ArtistEventLink>();
  private saves = new Set<string>();
  private pulse: PulseItem[] = [];

  async getEvents(filters: EventFilters): Promise<EventRecord[]> {
    let rows = [...this.events.values()];
    if (filters.day) rows = rows.filter((e) => e.day === filters.day);
    if (filters.genre) rows = rows.filter((e) => e.genres.includes(filters.genre as Genre));
    if (filters.liveOnly) rows = rows.filter((e) => e.activeNow);
    if (filters.undergroundOnly) rows = rows.filter((e) => e.underground);
    if (filters.query) {
      const q = filters.query.toLowerCase();
      rows = rows.filter((e) => [e.title, e.venue, e.area, ...e.lineup].join(" ").toLowerCase().includes(q));
    }
    return rows.sort((a, b) => {
      if (a.activeNow !== b.activeNow) return a.activeNow ? -1 : 1;
      if (a.trending !== b.trending) return a.trending ? -1 : 1;
      return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    });
  }

  async getEventById(id: string) {
    return this.events.get(id) ?? null;
  }

  async upsertEvent(event: EventRecord) {
    this.events.set(event.id, event);
    return event;
  }

  async saveLead(lead: LeadRecord) {
    this.leads.set(lead.id, lead);
    return lead;
  }

  async saveEventForEmail(email: string, eventId: string) {
    this.saves.add(`${email}::${eventId}`);
  }

  async revealPromo(eventId: string) {
    return this.events.get(eventId)?.promoCode ?? null;
  }

  async upsertArtist(artist: ArtistRecord) {
    const existingId = this.artistBySlug.get(artist.slug);
    if (existingId) return this.artists.get(existingId)!;
    this.artists.set(artist.id, artist);
    this.artistBySlug.set(artist.slug, artist.id);
    return artist;
  }

  async getArtistBySlug(slug: string) {
    const id = this.artistBySlug.get(slug);
    return id ? this.artists.get(id) ?? null : null;
  }

  async upsertArtistEventLink(link: ArtistEventLink) {
    const existing = [...this.links.values()].find((v) => v.artistId === link.artistId && v.eventId === link.eventId);
    if (existing) return existing;
    this.links.set(link.id, link);
    return link;
  }

  async applyEventOverrides(eventId: string, overrides: EventAdminOverride) {
    const current = this.events.get(eventId);
    if (!current) return null;

    const updated: EventRecord = {
      ...current,
      promoCode: overrides.promoCode !== undefined ? overrides.promoCode : current.promoCode,
      setTimes: overrides.setTimes ?? current.setTimes,
      underground: overrides.underground ?? current.underground,
      locationHint: overrides.locationHint ?? current.locationHint,
      insiderNote: overrides.insiderNote !== undefined ? overrides.insiderNote : current.insiderNote,
      price: overrides.price !== undefined ? overrides.price : current.price,
      updatedAt: new Date().toISOString(),
    };

    this.events.set(eventId, updated);
    return updated;
  }

  async getProviderEventUrls(providerName: string): Promise<string[]> {
    void providerName;
    return [];
  }

  async touchProviderSources(providerName: string): Promise<void> {
    void providerName;
  }

  async getAllEvents() {
    return [...this.events.values()];
  }

  async getAllArtists() {
    return [...this.artists.values()];
  }

  async getAllArtistEventLinks() {
    return [...this.links.values()];
  }

  async getPulseItems(limit = 50): Promise<PulseItem[]> {
    return [...this.pulse].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);
  }

  async createPulseItem(item: PulseItem): Promise<PulseItem> {
    this.pulse.push(item);
    if (this.pulse.length > 100) {
      this.pulse = this.pulse.slice(this.pulse.length - 100);
    }
    return item;
  }

  async upsertSyncState(record: SyncStateRecord): Promise<SyncStateRecord> {
    // in-memory: no-op, just return the record
    return record;
  }
}

type EventRow = {
  id: string;
  slug: string;
  title: string;
  venue: string;
  area: string;
  day: string;
  start_at: string;
  end_at: string;
  time_label: string;
  active_now: boolean;
  trending: boolean;
  underground: boolean;
  genres: string[];
  ticket_url: string;
  location_hint: string;
  map_x: number;
  map_y: number;
  lineup: string[];
  set_times: { time: string; artist: string }[];
  promo_code: string | null;
  insider_note: string | null;
  price: string | null;
  updated_at: string;
  source: EventRecord["source"];
};

type PulseRow = {
  id: string;
  text: string;
  urgency: "breaking" | "headsup" | "vibecheck";
  created_at: string;
};

function eventToRow(event: EventRecord): EventRow {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    venue: event.venue,
    area: event.area,
    day: event.day,
    start_at: event.startAt,
    end_at: event.endAt,
    time_label: event.timeLabel,
    active_now: event.activeNow,
    trending: event.trending,
    underground: event.underground,
    genres: event.genres,
    ticket_url: event.ticketUrl,
    location_hint: event.locationHint,
    map_x: event.coordinates.x,
    map_y: event.coordinates.y,
    lineup: event.lineup,
    set_times: event.setTimes,
    promo_code: event.promoCode,
    insider_note: event.insiderNote,
    price: event.price,
    updated_at: event.updatedAt,
    source: event.source,
  };
}

function rowToEvent(row: EventRow): EventRecord {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    venue: row.venue,
    area: row.area,
    day: row.day,
    startAt: row.start_at,
    endAt: row.end_at,
    timeLabel: row.time_label,
    activeNow: row.active_now,
    trending: row.trending,
    underground: row.underground,
    genres: row.genres as Genre[],
    ticketUrl: row.ticket_url,
    locationHint: row.location_hint,
    coordinates: { x: Number(row.map_x), y: Number(row.map_y) },
    lineup: row.lineup ?? [],
    setTimes: row.set_times ?? [],
    promoCode: row.promo_code,
    insiderNote: row.insider_note,
    price: row.price,
    updatedAt: row.updated_at,
    source: row.source ?? { provider: "unknown" },
  };
}

class SupabaseDatabase implements DatabaseAdapter {
  constructor(private client: SupabaseClient) {}

  async getEvents(filters: EventFilters): Promise<EventRecord[]> {
    let query = this.client.from("events").select("*");
    if (filters.day) query = query.eq("day", filters.day);
    if (filters.genre) query = query.contains("genres", [filters.genre]);
    if (filters.liveOnly) query = query.eq("active_now", true);
    if (filters.undergroundOnly) query = query.eq("underground", true);
    if (filters.query) query = query.or(`title.ilike.%${filters.query}%,venue.ilike.%${filters.query}%,area.ilike.%${filters.query}%`);

    const { data, error } = await query.order("active_now", { ascending: false }).order("trending", { ascending: false }).order("start_at", { ascending: true });
    if (error) throw error;
    return (data as EventRow[]).map(rowToEvent);
  }

  async getEventById(id: string): Promise<EventRecord | null> {
    const { data, error } = await this.client.from("events").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? rowToEvent(data as EventRow) : null;
  }

  async upsertEvent(event: EventRecord): Promise<EventRecord> {
    const row = eventToRow(event);
    const { data, error } = await this.client.from("events").upsert(row).select("*").single();
    if (error) throw error;
    return rowToEvent(data as EventRow);
  }

  async saveLead(lead: LeadRecord): Promise<LeadRecord> {
    const { error } = await this.client.from("leads").insert({
      id: lead.id,
      email: lead.email,
      source: lead.source,
      event_id: lead.eventId ?? null,
      created_at: lead.createdAt,
    });
    if (error) throw error;
    return lead;
  }

  async saveEventForEmail(email: string, eventId: string): Promise<void> {
    await this.saveLead({
      id: `lead_save_${Math.random().toString(36).slice(2, 12)}`,
      email,
      source: "save_event",
      eventId,
      createdAt: new Date().toISOString(),
    });
  }

  async revealPromo(eventId: string): Promise<string | null> {
    const { data, error } = await this.client.from("events").select("promo_code").eq("id", eventId).maybeSingle();
    if (error) throw error;
    return (data?.promo_code as string | null) ?? null;
  }

  async upsertArtist(artist: ArtistRecord): Promise<ArtistRecord> {
    const { data, error } = await this.client.from("artists").upsert({
      id: artist.id,
      name: artist.name,
      slug: artist.slug,
      created_at: artist.createdAt,
    }).select("*").single();
    if (error) throw error;
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      createdAt: data.created_at,
    };
  }

  async getArtistBySlug(slug: string): Promise<ArtistRecord | null> {
    const { data, error } = await this.client.from("artists").select("*").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      createdAt: data.created_at,
    };
  }

  async upsertArtistEventLink(link: ArtistEventLink): Promise<ArtistEventLink> {
    const { data, error } = await this.client.from("artist_event_links").upsert({
      id: link.id,
      artist_id: link.artistId,
      event_id: link.eventId,
      role: link.role,
      confidence: link.confidence,
      created_at: link.createdAt,
    }).select("*").single();
    if (error) throw error;
    return {
      id: data.id,
      artistId: data.artist_id,
      eventId: data.event_id,
      role: data.role,
      confidence: Number(data.confidence),
      createdAt: data.created_at,
    };
  }

  async applyEventOverrides(eventId: string, overrides: EventAdminOverride): Promise<EventRecord | null> {
    const patch: Record<string, unknown> = {};
    if (overrides.promoCode !== undefined) patch.promo_code = overrides.promoCode;
    if (overrides.setTimes !== undefined) patch.set_times = overrides.setTimes;
    if (overrides.underground !== undefined) patch.underground = overrides.underground;
    if (overrides.locationHint !== undefined) patch.location_hint = overrides.locationHint;
    if (overrides.insiderNote !== undefined) patch.insider_note = overrides.insiderNote;
    if (overrides.price !== undefined) patch.price = overrides.price;
    patch.updated_at = new Date().toISOString();

    const { data, error } = await this.client.from("events").update(patch).eq("id", eventId).select("*").maybeSingle();
    if (error) throw error;
    return data ? rowToEvent(data as EventRow) : null;
  }

  async getProviderEventUrls(providerName: string): Promise<string[]> {
    const { data, error } = await this.client
      .from("provider_sources")
      .select("event_url")
      .eq("provider_name", providerName)
      .eq("status", "active");

    if (error) {
      const dbError = error as { code?: string };
      if (dbError.code === "42P01") return [];
      throw error;
    }

    return (data ?? [])
      .map((row) => row.event_url as string)
      .filter((url) => typeof url === "string" && url.trim().length > 0);
  }

  async touchProviderSources(providerName: string): Promise<void> {
    const { error } = await this.client
      .from("provider_sources")
      .update({
        last_ingested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("provider_name", providerName)
      .eq("status", "active");

    if (error) {
      const dbError = error as { code?: string };
      if (dbError.code === "42P01") return;
      throw error;
    }
  }

  async getAllEvents(): Promise<EventRecord[]> {
    const { data, error } = await this.client.from("events").select("*");
    if (error) throw error;
    return (data as EventRow[]).map(rowToEvent);
  }

  async getAllArtists(): Promise<ArtistRecord[]> {
    const { data, error } = await this.client.from("artists").select("*");
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      createdAt: row.created_at,
    }));
  }

  async getAllArtistEventLinks(): Promise<ArtistEventLink[]> {
    const { data, error } = await this.client.from("artist_event_links").select("*");
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      artistId: row.artist_id,
      eventId: row.event_id,
      role: row.role,
      confidence: Number(row.confidence),
      createdAt: row.created_at,
    }));
  }

  async getPulseItems(limit = 50): Promise<PulseItem[]> {
    const { data, error } = await this.client.from("pulse").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return (data as PulseRow[]).map((row) => ({
      id: row.id,
      text: row.text,
      urgency: row.urgency,
      createdAt: row.created_at,
    }));
  }

  async createPulseItem(item: PulseItem): Promise<PulseItem> {
    const { data, error } = await this.client
      .from("pulse")
      .insert({
        id: item.id,
        text: item.text,
        urgency: item.urgency,
        created_at: item.createdAt,
      })
      .select("*")
      .single();

    if (error) throw error;

    return {
      id: data.id,
      text: data.text,
      urgency: data.urgency,
      createdAt: data.created_at,
    };
  }

  async upsertSyncState(record: SyncStateRecord): Promise<SyncStateRecord> {
    const { error } = await this.client.from("deployment_sync_state").upsert({
      id: record.id,
      environment: record.environment,
      git_branch: record.gitBranch,
      git_commit: record.gitCommit,
      remote_url: record.remoteUrl,
      app_base_url: record.appBaseUrl,
      status: record.status,
      generated_at: record.generatedAt,
      notes: record.notes,
    });
    if (error) {
      const dbError = error as { code?: string };
      if (dbError.code === "42P01") return record; // table not yet created
      throw error;
    }
    return record;
  }
}

function makeAdapter(): DatabaseAdapter {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const hasPlaceholderUrl = typeof url === "string" && url.includes("your-project.supabase.co");
  const hasPlaceholderKey = typeof key === "string" && key.toLowerCase().includes("your_");

  if (url && key && !hasPlaceholderUrl && !hasPlaceholderKey) {
    const client = createClient(url, key, { auth: { persistSession: false } });
    return new SupabaseDatabase(client);
  }

  return new InMemoryDatabase();
}

export const db: DatabaseAdapter = makeAdapter();
