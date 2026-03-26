import { db, type DatabaseAdapter } from "@/lib/db";
import { splitArtists } from "@/lib/event-helpers";
import type { ArtistEventLink, ArtistRecord, UndergroundConnection } from "@/lib/types";
import { nowIso, slugify, uid } from "@/lib/utils-core";

export async function indexArtistsForEvent(eventId: string, adapter: DatabaseAdapter = db) {
  const event = await adapter.getEventById(eventId);
  if (!event) return null;

  const names = splitArtists(event.lineup);
  const created: { artists: ArtistRecord[]; links: ArtistEventLink[] } = { artists: [], links: [] };

  for (const name of names) {
    const slug = slugify(name);
    let artist = await adapter.getArtistBySlug(slug);
    if (!artist) {
      artist = await adapter.upsertArtist({
        id: uid("artist"),
        name,
        slug,
        createdAt: nowIso(),
      });
      created.artists.push(artist);
    }

    const role: ArtistEventLink["role"] = event.lineup[0]?.toLowerCase().includes(name.toLowerCase()) ? "headliner" : "support";
    const link = await adapter.upsertArtistEventLink({
      id: uid("ael"),
      artistId: artist.id,
      eventId: event.id,
      role,
      confidence: 0.9,
      createdAt: nowIso(),
    });
    created.links.push(link);
  }

  return created;
}

export async function buildArtistIndex(adapter: DatabaseAdapter = db) {
  const events = await adapter.getAllEvents();
  const results = [];
  for (const event of events) results.push(await indexArtistsForEvent(event.id, adapter));
  return results;
}

export async function buildUndergroundConnections(adapter: DatabaseAdapter = db): Promise<UndergroundConnection[]> {
  const events = await adapter.getAllEvents();
  const artists = await adapter.getAllArtists();
  const links = await adapter.getAllArtistEventLinks();

  const artistMap = new Map(artists.map((artist) => [artist.id, artist]));
  const eventMap = new Map(events.map((event) => [event.id, event]));
  const linksByArtist = new Map<string, typeof links>();

  for (const link of links) {
    const group = linksByArtist.get(link.artistId) ?? [];
    group.push(link);
    linksByArtist.set(link.artistId, group);
  }

  const output: UndergroundConnection[] = [];

  for (const [artistId, artistLinks] of linksByArtist.entries()) {
    if (artistLinks.length < 2) continue;
    const artist = artistMap.get(artistId);
    if (!artist) continue;

    for (let i = 0; i < artistLinks.length; i++) {
      for (let j = i + 1; j < artistLinks.length; j++) {
        const a = artistLinks[i];
        const b = artistLinks[j];
        const sourceEvent = eventMap.get(a.eventId);
        const relatedEvent = eventMap.get(b.eventId);
        if (!sourceEvent || !relatedEvent) continue;

        const weight =
          (sourceEvent.underground ? 2 : 1) +
          (relatedEvent.underground ? 2 : 1) +
          (sourceEvent.trending ? 1 : 0) +
          (relatedEvent.trending ? 1 : 0);

        output.push({
          artistName: artist.name,
          sourceEventId: sourceEvent.id,
          sourceEventTitle: sourceEvent.title,
          relatedEventId: relatedEvent.id,
          relatedEventTitle: relatedEvent.title,
          venue: relatedEvent.venue,
          day: relatedEvent.day,
          weight,
          reason: `${artist.name} appears on both lineups`,
        });
      }
    }
  }

  return output.sort((a, b) => b.weight - a.weight);
}

export async function getUndergroundLayerForEvent(eventId: string, adapter: DatabaseAdapter = db) {
  const connections = await buildUndergroundConnections(adapter);
  return connections.filter((c) => c.sourceEventId === eventId || c.relatedEventId === eventId);
}
