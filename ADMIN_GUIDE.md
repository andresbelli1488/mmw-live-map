# Admin Guide: MMW Live Map Management

## Overview

This guide covers:
1. Managing provider source URLs (RA, Shotgun, etc.)
2. Using the admin override endpoint for post-ingestion edits
3. Triggering manual ingestion
4. Monitoring ingestion logs

---

## 1. Provider Source Management

### Why Provider Sources?

The three-layer ingestion strategy works better when you maintain a list of known event URLs:

1. **Layer 1 (Preferred):** Fetch from curated JSON feed URL (if `RA_FEED_URL` or `SHOTGUN_FEED_URL` env var exists)
2. **Layer 2 (Supported):** Fetch from known URLs stored in `provider_sources` table
3. **Layer 3 (Fallback):** Discover new URLs via search (slower, less reliable)

### Adding Provider URLs

**SQL Insert:**

```sql
insert into provider_sources (
  id,
  provider_name,
  event_url,
  status,
  notes,
  created_at
)
values
  (gen_random_uuid()::text, 'resident-advisor', 'https://ra.co/events/1234567', 'active', 'Experts Only Opening Night', now()),
  (gen_random_uuid()::text, 'shotgun', 'https://shotgun.live/events/warehouse-signal', 'active', 'Thursday secret lot', now());
```

**Fields:**
- `provider_name`: `resident-advisor` or `shotgun`
- `event_url`: Full URL to the event page
- `status`: `active` (will be ingested) or `inactive` (skipped)
- `notes`: Optional context for ops team
- `last_ingested_at`: Auto-updated when ingestion runs

### Disabling a URL

```sql
update provider_sources
set status = 'inactive'
where event_url = 'https://ra.co/events/1234567';
```

### Viewing All Active URLs

```sql
select provider_name, event_url, last_ingested_at, notes
from provider_sources
where status = 'active'
order by last_ingested_at desc nulls first;
```

---

## 2. Event Admin Overrides

### What Can Be Overridden?

After ingestion, you can patch individual events with admin edits:
- `promo_code` — Reveal-gate promotion code
- `set_times` — Exact set times (array of `{ time, artist }`)
- `underground` — Mark as underground-adjacent
- `location_hint` — Vague location ("East of the bridge") for secret venues
- `insider_note` — Curator notes ("VIP only after midnight")
- `price` — Corrected ticket price

### Making an Override

**Endpoint:**
```
POST /api/admin/events/{eventId}/override
Header: x-ingest-key: YOUR_INGEST_ADMIN_KEY
Body: { ... override fields ... }
```

**Example using curl:**

```bash
curl -X POST http://localhost:3000/api/admin/events/resident-advisor_experts-only \
  -H "Content-Type: application/json" \
  -H "x-ingest-key: your-secret-key" \
  -d '{
    "promo_code": "WOMB10",
    "underground": true,
    "location_hint": "Downtown warehouse, ask at door",
    "insider_note": "Restricted to 21+ with prior RSVP",
    "price": "$45 advance / $60 door"
  }'
```

**Response:**
```json
{
  "ok": true,
  "event": {
    "id": "resident-advisor_experts-only",
    "title": "Experts Only Opening Night",
    "venue": "Club Space",
    "promoCode": "WOMB10",
    "underground": true,
    "locationHint": "Downtown warehouse, ask at door",
    "insiderNote": "Restricted to 21+ with prior RSVP",
    "price": "$45 advance / $60 door",
    ...
  }
}
```

---

## 3. Manual Ingestion Triggers

### Bootstrap Seed Events Only

```bash
curl -X POST http://localhost:3000/api/bootstrap
```

Response:
```json
{
  "ok": true,
  "ingested": 2,
  "undergroundConnections": 0,
  "generatedAt": "2026-03-25T14:30:00Z"
}
```

### Full Ingestion with All Providers

```bash
curl -X POST http://localhost:3000/api/admin/ingest \
  -H "Content-Type: application/json" \
  -H "x-ingest-key: your-secret-key" \
  -d '{
    "includeSeed": true
  }'
```

Options:
- `includeSeed: true` — Include StaticSeedProvider (default)
- `includeSeed: false` — Skip seed, use live providers only

Response includes telemetry:
```json
{
  "ok": true,
  "ingested": 45,
  "undergroundConnections": 120,
  "generatedAt": "2026-03-25T14:30:00Z"
}
```

### Automatic Cron Ingestion

Once deployed to Vercel, ingestion automatically runs every 30 minutes via `vercel.json` config.

Monitor in Vercel dashboard:
- Go to **Deployments → Cron Jobs**
- See last execution time and logs

---

## 4. Revealing Promo Codes

Users reveal promo codes (and generate leads) by hitting:

```bash
POST /api/events/{eventId}/reveal
Body: { "email": "user@example.com" }
```

This:
1. Logs an email lead with source `promo_reveal`
2. Returns the event's `promo_code` (if set)
3. Marks lead for retargeting campaigns

---

## 5. Monitoring & Debugging

### Check Recent Events

```bash
curl http://localhost:3000/api/events?liveOnly=true | jq '.events | length'
```

### Check Underground Connections for One Event

```bash
curl http://localhost:3000/api/events/resident-advisor_experts-only | jq '.undergroundLayer'
```

### Check Admin Overrides Applied

```sql
select event_id, promo_code, underground, location_hint, updated_at
from event_admin_overrides
order by updated_at desc;
```

### Check Provider Source Ingestion Status

```sql
select provider_name, count(*) as count, max(last_ingested_at) as last_run
from provider_sources
where status = 'active'
group by provider_name;
```

---

## 6. Production Workflow

**Before MMW Starts:**
1. Add all known RA/Shotgun URLs to `provider_sources` table
2. Set `RA_FEED_URL` and `SHOTGUN_FEED_URL` if you have curated JSON feeds
3. Deploy to Vercel; cron starts automatically
4. Trigger `/api/bootstrap` to seed initial data

**During MMW:**
1. Thrice daily: Review ingested events for accuracy
2. As needed: Use admin override endpoint to fix set times, promo codes, underground flags
3. Monitor cron logs in Vercel dashboard
4. Add new event URLs to `provider_sources` as discovered

**Troubleshooting:**
- No events ingested? Check `provider_sources` table is populated and has `status = 'active'`
- Event data looks wrong? Use `/api/admin/events/[id]/override` to patch
- Cron not running? Check Vercel `vercel.json` is deployed and secrets are set

---

## 7. Quick Reference: Event ID Format

Event IDs are generated as `{provider}_{urlSlug}`:

- Resident Advisor: `resident-advisor_experts-only`
- Shotgun: `shotgun_warehouse-signal`
- Dice: `dice_friday-night-beats`
- Eventbrite: `eventbrite_mmw-opening-party`
- Seed: `seed_experts-only-space-opening`

Use these IDs in override and reveal endpoints.
