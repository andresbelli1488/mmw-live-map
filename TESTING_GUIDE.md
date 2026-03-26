# Local Testing Guide

This guide shows how to test all endpoints and workflows locally before deploying to Render.

## Prerequisites

1. **Supabase setup complete** — See [SUPABASE_SETUP.md](SUPABASE_SETUP.md)
2. **Env vars configured** — `.env.local` with `SUPABASE_*` keys
3. **Dev server running** — `npm run dev`
4. **Curl or Postman** — For making HTTP requests

---

## 1. Test Database Connection

### Health Check

```bash
curl http://localhost:3000/api/events
```

Expected response (200 OK):
```json
{
  "events": [],
  "days": {},
  "generatedAt": "2026-03-25T14:30:00Z"
}
```

If you get a 500 error:
- Check `.env.local` has correct Supabase credentials
- Verify schema was initialized in Supabase SQL Editor
- Check Supabase project is running (not paused)

---

## 2. Seed Initial Data

### Bootstrap Seed Provider Only

```bash
curl -X POST http://localhost:3000/api/bootstrap \
  -H "Content-Type: application/json"
```

Expected response (201 Created):
```json
{
  "ingested": 75,
  "undergroundConnections": 0,
  "generatedAt": "2026-03-25T14:30:45Z"
}
```

### Verify Events Were Inserted

```bash
curl http://localhost:3000/api/events
```

Should now return the full 75-event MMW 2026 seed dataset.

---

## 3. Test Event Filtering

### Get Live Events Only

```bash
curl "http://localhost:3000/api/events?liveOnly=true"
```

### Filter by Genre

```bash
curl "http://localhost:3000/api/events?genre=Tech%20House"
```

### Filter by Area

```bash
curl "http://localhost:3000/api/events?area=Downtown"
```

### Search by Query

```bash
curl "http://localhost:3000/api/events?query=Experts"
```

### Get Underground Events

```bash
curl "http://localhost:3000/api/events?undergroundOnly=true"
```

### Combine Filters

```bash
curl "http://localhost:3000/api/events?liveOnly=true&area=Wynwood&undergroundOnly=true"
```

---

## 4. Test Individual Event Details

### Get Event by ID

```bash
curl http://localhost:3000/api/events/seed_experts-only-space-opening
```

Response includes the event and its `undergroundLayer` (connected events via shared artists).

---

## 5. Test Promo Code Reveal

### Reveal Promo Code

```bash
curl -X POST http://localhost:3000/api/events/seed_experts-only-space-opening/reveal \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

Expected response (200 OK):
```json
{
  "ok": true,
  "promoCode": "WOMB10",
  "revealed": true
}
```

### Verify Lead Was Captured

```bash
# In Supabase SQL Editor, run:
select email, source, event_id from leads where source = 'promo_reveal' limit 5;
```

---

## 6. Test Event Bookmarking

### Save Event

```bash
curl -X POST http://localhost:3000/api/events/seed_experts-only-space-opening/save \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

Expected response (200 OK):
```json
{
  "ok": true,
  "saved": true
}
```

### Verify Save Was Logged

```bash
# In Supabase SQL Editor, run:
select email, event_id from leads where source = 'save' limit 5;
```

---

## 7. Test Lead Capture

### Submit Generic Lead

```bash
curl -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newsletter@example.com",
    "source": "newsletter_signup"
  }'
```

Expected response (201 Created):
```json
{
  "ok": true,
  "lead": {
    "id": "...",
    "email": "newsletter@example.com",
    "source": "newsletter_signup",
    "createdAt": "2026-03-25T14:35:00Z"
  }
}
```

### Test Invalid Lead (Missing Email)

```bash
curl -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "source": "bad_request"
  }'
```

Expected response (400 Bad Request):
```json
{
  "error": "Email and source are required"
}
```

---

## 8. Test Admin Endpoints

### Set INGEST_ADMIN_KEY in .env.local

Add to `.env.local`:
```
INGEST_ADMIN_KEY=test-secret-key-12345
```

Restart dev server: `npm run dev`

### Manual Ingestion with Admin Key

```bash
curl -X POST http://localhost:3000/api/admin/ingest \
  -H "Content-Type: application/json" \
  -H "x-ingest-key: test-secret-key-12345" \
  -d '{
    "includeSeed": true
  }'
```

Expected response (200 OK):
```json
{
  "ingested": 75,
  "undergroundConnections": 0,
  "generatedAt": "2026-03-25T14:40:00Z"
}
```

### Test Invalid Admin Key

```bash
curl -X POST http://localhost:3000/api/admin/ingest \
  -H "Content-Type: application/json" \
  -H "x-ingest-key: wrong-key" \
  -d '{
    "includeSeed": true
  }'
```

Expected response (401 Unauthorized):
```json
{
  "error": "Unauthorized"
}
```

---

## 9. Test Event Admin Override

### Override Event Metadata

```bash
curl -X POST http://localhost:3000/api/admin/events/seed_experts-only-space-opening/override \
  -H "Content-Type: application/json" \
  -H "x-ingest-key: test-secret-key-12345" \
  -d '{
    "promoCode": "VIPACCESS20",
    "underground": true,
    "locationHint": "Ask host at entrance",
    "insiderNote": "Invite-only after 2 AM",
    "price": "$50"
  }'
```

Expected response (200 OK):
```json
{
  "ok": true,
  "event": {
    "id": "seed_experts-only-space-opening",
    "title": "Experts Only: Opening Party",
    "promoCode": "VIPACCESS20",
    "underground": true,
    "locationHint": "Ask host at entrance",
    "insiderNote": "Invite-only after 2 AM",
    "price": "$50",
    ...
  }
}
```

### Verify Override Was Applied

```bash
curl http://localhost:3000/api/events/seed_experts-only-space-opening | jq '.event | {promoCode, underground, locationHint}'
```

### Override Non-Existent Event

```bash
curl -X POST http://localhost:3000/api/admin/events/does-not-exist/override \
  -H "Content-Type: application/json" \
  -H "x-ingest-key: test-secret-key-12345" \
  -d '{"promoCode": "TEST"}'
```

Expected response (404 Not Found):
```json
{
  "error": "Event not found"
}
```

---

## 10. Database Inspection Queries

### Total Events in DB

```sql
select count(*) as total_events from events;
```

### Artists Index

```sql
select name, count(distinct event_id) as event_count
from artists
join artist_event_links on artist_event_links.artist_id = artists.id
group by artists.id, name
order by event_count desc;
```

### Underground Connections (Event Pairs)

```sql
select e1.title as event_a, e2.title as event_b, weight
from underground_connections uc
join events e1 on e1.id = uc.event_id_a
join events e2 on e2.id = uc.event_id_b
order by weight desc;
```

### Admin Overrides Applied

```sql
select event_id, promo_code, underground, location_hint, updated_at
from event_admin_overrides
order by updated_at desc;
```

### Leads Captured

```sql
select email, source, event_id, created_at
from leads
order by created_at desc
limit 20;
```

---

## 11. Complete E2E Workflow Test

Run these in order to verify the full pipeline:

```bash
# 1. Clear old data (if re-testing)
# In Supabase SQL Editor:
truncate table events, artists, artist_event_links, underground_connections, event_admin_overrides, leads restart identity cascade;

# 2. Seed initial data
curl -X POST http://localhost:3000/api/bootstrap

# 3. Check events exist
curl http://localhost:3000/api/events

# 4. Boost an event as underground
curl -X POST http://localhost:3000/api/admin/events/seed_experts-only-space-opening/override \
  -H "Content-Type: application/json" \
  -H "x-ingest-key: test-secret-key-12345" \
  -d '{"underground": true}'

# 5. Verify override applied
curl http://localhost:3000/api/events/seed_experts-only-space-opening | jq '.event.underground'

# 6. User reveals promo code
curl -X POST http://localhost:3000/api/events/seed_experts-only-space-opening/reveal \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# 7. User saves event
curl -X POST http://localhost:3000/api/events/seed_experts-only-space-opening/save \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# 8. Check leads were captured
curl http://localhost:3000/api/events | jq '.events | length'
# Should show 75 events

# 9. Check leads in DB
# In Supabase SQL Editor:
select count(*) from leads;
# Should show 2 leads (promo_reveal + save)

# ✅ All systems go!
```

---

## Troubleshooting

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| 500 error on all endpoints | DB connection failed | Check env vars, verify schema |
| 401 Unauthorized on admin endpoints | Admin key mismatch | Verify `INGEST_ADMIN_KEY` in .env.local matches header |
| Events return empty array | No ingestion run | Run `POST /api/bootstrap` first |
| Promo code returns null | Not set on event | Use override endpoint to add `promoCode` |
| Location_hint doesn't show | Need override | Underground events need explicit location_hint via override |

---

## Next Steps

Once all tests pass:
1. Commit code to Git
2. Push to GitHub
3. Connect repo to Render (Blueprint)
4. Deploy web + cron services
5. Use `/api/bootstrap` on Render to seed initial data

See [SUPABASE_SETUP.md](SUPABASE_SETUP.md#production-deployment-render) for production deployment steps.
