# MMW Live Map (Next.js App Router)

This workspace implements the App Router friendly project split for MMW Live Map:

- API endpoints under `app/api`
- Domain/data helpers under `lib`
- Ingestion and underground graph indexers under `lib/ingestion` and `lib/underground-graph.ts`

## Quick start

```bash
npm install
npm run dev
```

## Seed data

Seed in-memory data:

```bash
curl -X POST http://localhost:3000/api/bootstrap
```

Run full ingestion provider pipeline:

```bash
curl -X POST http://localhost:3000/api/admin/ingest
```

## Key API routes

- `GET /api/events`
- `GET /api/events/[id]`
- `POST /api/events/[id]/reveal`
- `POST /api/events/[id]/save`
- `POST /api/leads`
- `POST /api/bootstrap`
- `POST /api/admin/ingest`
- `POST /api/admin/events/[id]/override`

## Production wiring included

- Supabase-backed Postgres adapter is auto-enabled when these env vars exist:
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `SUPABASE_SERVICE_ROLE_KEY`
- In-memory fallback remains active when those env vars are absent.
- Render-ready deployment is configured in `render.yaml` with a 30-minute cron service.
- Optional endpoint hardening is available via `INGEST_ADMIN_KEY` header (`x-ingest-key`).
- Real provider adapters can ingest from JSON feed URLs:
	- `RA_FEED_URL`
	- `DICE_FEED_URL`
	- `EVENTBRITE_FEED_URL`
	- `SHOTGUN_FEED_URL`
	- `MMW_BASE_URL` (for Render cron service target)

## Deploy on Render

1. Push this repo to GitHub.
2. In Render, create a Blueprint and point it to this repository.
3. Render will detect `render.yaml` and create:
	- Web service: `mmw-live-map`
	- Cron service: `mmw-live-map-ingest-cron`
4. Set required env vars in Render:
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `SUPABASE_SERVICE_ROLE_KEY`
	- `INGEST_ADMIN_KEY`
	- `MMW_BASE_URL` (the live Render web URL)
5. Deploy and verify:
	- `GET /api/events`
	- `POST /api/bootstrap`
	- `GET /api/pulse`

## Synchronization and awareness

Run this command before and after each deployment:

```bash
npm run sync:awareness
```

It creates `logs/sync-awareness-latest.json` with:
- Local git cleanliness and branch/commit
- Origin tracking state (ahead/behind)
- Deployed health checks for `/api/events` and `/api/pulse` (when `DEPLOYED_BASE_URL` or `MMW_BASE_URL` is set)
- A single `syncHealthy` flag for release readiness

## Admin overrides

`POST /api/admin/events/[id]/override`

Body fields supported:
- `setTimes`
- `promoCode`
- `underground`
- `locationHint`
- `insiderNote`
- `price`

## Production swaps

1. Replace `InMemoryDatabase` in `lib/db.ts` with Prisma/Drizzle/Supabase adapter.
2. Implement real provider adapters in `lib/ingestion/providers.ts`.
3. Add scheduled ingestion (for example Render cron service posting to `/api/admin/ingest`).
4. Add admin overrides for promo codes, set times, underground flags, and location visibility.
5. Track deployment state in `deployment_sync_state` and `deployment_audit_log`.
