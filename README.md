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
- Cron-ready ingestion is configured in `vercel.json` for `/api/admin/ingest`.
- Optional endpoint hardening is available via `INGEST_ADMIN_KEY` header (`x-ingest-key`).
- Real provider adapters can ingest from JSON feed URLs:
	- `RA_FEED_URL`
	- `DICE_FEED_URL`
	- `EVENTBRITE_FEED_URL`
	- `SHOTGUN_FEED_URL`

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
3. Add scheduled ingestion (for example Vercel Cron to `/api/admin/ingest`).
4. Add admin overrides for promo codes, set times, underground flags, and location visibility.
