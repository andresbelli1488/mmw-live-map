# Supabase Setup Guide for MMW Live Map

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Enter project name: `mmw-live-map` (or similar)
4. Create a strong database password and save it somewhere safe
5. Select your desired region (closest to Miami = us-east-1 recommended)
6. Click **"Create new project"** and wait ~2 min for initialization

## Step 2: Get API Credentials

Once the project is created:

1. Go to **Settings → API** in the left sidebar
2. Under "Project API keys", copy:
   - **`NEXT_PUBLIC_SUPABASE_URL`** (the base URL)
   - **`SUPABASE_SERVICE_ROLE_KEY`** (the secret key, use for backend only)
3. Save these securely

## Step 3: Initialize Database Schema

In the Supabase dashboard:

1. Go to **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Copy and paste the full schema from [`lib/postgres-schema.sql`](lib/postgres-schema.sql)
4. Click **"Run"** to execute the schema initialization

This creates all required tables:
- `events`
- `artists`
- `artist_event_links`
- `underground_connections`
- `event_admin_overrides`
- `leads`
- `provider_sources` (for admin URL management)
- `pulse`

## Step 4: Create .env.local

In the project root, create `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Optional: Ingestion Security
INGEST_ADMIN_KEY=your-secret-admin-key-here

# Optional: Provider Feed URLs (curated JSON endpoints)
RA_FEED_URL=https://your-feed.example.com/ra-events.json
SHOTGUN_FEED_URL=https://your-feed.example.com/shotgun-events.json
DICE_FEED_URL=https://your-feed.example.com/dice-events.json
EVENTBRITE_FEED_URL=https://your-feed.example.com/eventbrite-events.json

# Render cron target URL
MMW_BASE_URL=https://mmw-live-map.onrender.com
```

## Step 5: Test Connection Locally

```bash
npm run dev
# Open http://localhost:3000/api/events
# Should return { events: [], days: {}, generatedAt: "..." }
```

If you get a 500 error, check:
- Env vars are spelled correctly
- Supabase URL doesn't have trailing slash
- Service Role Key is the SECRET key (not the anon key)

## Step 6: Populate Provider Sources (Optional but Recommended)

See [ADMIN_GUIDE.md](ADMIN_GUIDE.md) for instructions on adding RA/Shotgun URLs to the `provider_sources` table.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "getaddrinfo ENOTFOUND your-project.supabase.co" | Replace placeholder URL with your real Supabase project URL |
| Connection timeout | Check Supabase URL and internet connection |
| "SUPABASE_SERVICE_ROLE_KEY missing" | Verify env var name spelling (case-sensitive) |
| "relation does not exist" | Schema didn't run; re-run `lib/postgres-schema.sql` |
| Events appear empty after seed | Run `POST /api/bootstrap` to trigger ingestion |

## Production Deployment (Render)

Once tested locally:

1. Push code to GitHub (include `.env.local` in `.gitignore`)
2. Connect repo to Render via Blueprint (`render.yaml`)
3. Add these secrets in Render web service environment:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `INGEST_ADMIN_KEY` (if using)
   - `RA_FEED_URL`, `SHOTGUN_FEED_URL`, etc. (if using)
4. Add these secrets in Render cron service environment:
   - `MMW_BASE_URL`
   - `INGEST_ADMIN_KEY`
5. Deploy
6. Cron service will trigger `/api/admin/ingest` every 30 minutes

## Next: Admin URL Management

See [ADMIN_GUIDE.md](ADMIN_GUIDE.md) to learn how to add and manage event URLs for the three-layer ingestion providers.
