# Deployment Checklist: MMW Live Map

Use this checklist to go from local development to production deployment on Render.

---

## Pre-Deployment (Local)

- [ ] **Supabase Project Created**
  - [ ] Project name: `mmw-live-map`
  - [ ] Database password saved securely
  - [ ] Region: `us-east-1` (or closest to Miami)
  - [ ] See: [SUPABASE_SETUP.md](SUPABASE_SETUP.md#step-1-create-supabase-project)

- [ ] **Schema Initialized**
  - [ ] SQL from `lib/postgres-schema.sql` executed in Supabase SQL Editor
  - [ ] Tables created: `events`, `artists`, `artist_event_links`, `underground_connections`, `event_admin_overrides`, `provider_sources`, `leads`, `pulse`
  - [ ] See: [SUPABASE_SETUP.md](SUPABASE_SETUP.md#step-3-initialize-database-schema)

- [ ] **Credentials Captured**
  - [ ] `NEXT_PUBLIC_SUPABASE_URL` copied
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` copied (the SECRET key, not anon)
  - [ ] See: [SUPABASE_SETUP.md](SUPABASE_SETUP.md#step-2-get-api-credentials)

- [ ] **Local Env Configured**
  - [ ] `.env.local` created with all required vars (see template in `.env.example`)
  - [ ] Optional: `INGEST_ADMIN_KEY` set to a strong random value
  - [ ] Optional: Provider feed URLs set if available (`RA_FEED_URL`, `SHOTGUN_FEED_URL`, etc.)
  - [ ] See: [SUPABASE_SETUP.md](SUPABASE_SETUP.md#step-4-create-envlocal)

- [ ] **Local Dev Server Tested**
  - [ ] `npm run dev` started
  - [ ] Health check: `curl http://localhost:3000/api/events` returns 200 OK
  - [ ] Bootstrap seed: `curl -X POST http://localhost:3000/api/bootstrap` returns ingested: 75
  - [ ] See: [TESTING_GUIDE.md](TESTING_GUIDE.md)

- [ ] **Admin Endpoints Tested**
  - [ ] Override endpoint tested with valid admin key
  - [ ] Override endpoint returns 401 with invalid key
  - [ ] Ingest endpoint tested with valid admin key
  - [ ] See: [TESTING_GUIDE.md](TESTING_GUIDE.md#8-test-admin-endpoints)

- [ ] **E2E Workflow Verified**
  - [ ] Seed → Ingest → Override → Reveal → Save workflow tested
  - [ ] All database operations logged correctly
  - [ ] See: [TESTING_GUIDE.md](TESTING_GUIDE.md#11-complete-e2e-workflow-test)

- [ ] **Provider Sources Populated** (Optional but Recommended)
  - [ ] Known RA/Shotgun event URLs added to `provider_sources` table
  - [ ] At least 5–10 URLs per provider for good ingestion coverage
  - [ ] See: [ADMIN_GUIDE.md](ADMIN_GUIDE.md#1-provider-source-management)

---

## Git & Repository

- [ ] **Code Committed**
  - [ ] `npm run build` passes (0 errors)
  - [ ] `git add .` (ensure `.env.local` and `node_modules/` are in `.gitignore`)
  - [ ] `git commit -m "Production backend: Supabase, RA/Shotgun providers, admin overrides, cron"`
  - [ ] `git push origin main`

- [ ] **GitHub Remote Ready**
  - [ ] Repo is public or accessible to Render
  - [ ] Primary branch is `main` (or configured in Render)

---

## Render Deployment

- [ ] **Render Blueprint Linked**
  - [ ] Go to [render.com](https://render.com)
  - [ ] Click "New" → "Blueprint"
  - [ ] Import GitHub repo for MMW Live Map
  - [ ] Confirm `render.yaml` is detected
  - [ ] Create services (`mmw-live-map`, `mmw-live-map-ingest-cron`)

- [ ] **Environment Secrets Configured**
  - [ ] In Render dashboard, open both services and set environment variables
  - [ ] Add these variables to web service:
    - [ ] `NEXT_PUBLIC_SUPABASE_URL`
    - [ ] `SUPABASE_SERVICE_ROLE_KEY`
    - [ ] `INGEST_ADMIN_KEY` (if using)
    - [ ] `RA_FEED_URL` (if configuring external curated feeds)
    - [ ] `SHOTGUN_FEED_URL` (if configuring external curated feeds)
    - [ ] `DICE_FEED_URL` (optional)
    - [ ] `EVENTBRITE_FEED_URL` (optional)
  - [ ] Add these variables to cron service:
    - [ ] `MMW_BASE_URL` (e.g. `https://mmw-live-map.onrender.com`)
    - [ ] `INGEST_ADMIN_KEY`
  - [ ] Save and redeploy both services

- [ ] **Build & Deployment Verified**
  - [ ] Render build succeeds (check **Events/Logs** tab)
  - [ ] URL is live: `https://your-project.onrender.com/api/events` returns 200 OK

- [ ] **Cron Configured**
  - [ ] `render.yaml` is present in root with cron service config
  - [ ] Confirm cron service `mmw-live-map-ingest-cron` exists in Render
  - [ ] Confirm schedule is `*/30 * * * *` (every 30 min)
  - [ ] Check cron logs to verify successful ingestion calls

---

## Post-Deployment (Production)

- [ ] **Initial Data Seed**
  - [ ] Trigger: `curl https://your-project.onrender.com/api/bootstrap`
  - [ ] Should return `{ ingested: 75, undergroundConnections: ..., generatedAt: "..." }`
  - [ ] Verify in Supabase: `select count(*) from events;` → should show 75

- [ ] **Admin Override Test (Production)**
  - [ ] Test override endpoint:
    ```bash
    curl -X POST https://your-project.onrender.com/api/admin/events/seed_experts-only-space-opening/override \
      -H "x-ingest-key: YOUR_INGEST_ADMIN_KEY" \
      -d '{"promoCode": "TEST123"}'
    ```
  - [ ] Should return 200 OK with updated event

- [ ] **Cron Ingestion Log**
  - [ ] Open Render cron service logs (`mmw-live-map-ingest-cron`)
  - [ ] Wait 30 minutes OR trigger a manual run from Render dashboard
  - [ ] See execution log and verify no errors
  - [ ] Check Supabase: `select count(*) from events;` should be updated

- [ ] **Monitor Initial 24 Hours**
  - [ ] Check Render service logs (zero 5xx errors)
  - [ ] Check cron execution logs (successful runs)
  - [ ] Sample event from `/api/events` and verify structure
  - [ ] Test promo reveal and event save endpoints from frontend

---

## Admin Setup (Ongoing)

- [ ] **Provider Sources Table Populated**
  - [ ] In Supabase, populate `provider_sources` with known event URLs
  - [ ] Example:
    ```sql
    insert into provider_sources (id, provider_name, event_url, status, notes, created_at)
    values (gen_random_uuid()::text, 'resident-advisor', 'https://ra.co/events/1234567', 'active', 'Opening night', now());
    ```
  - [ ] See: [ADMIN_GUIDE.md](ADMIN_GUIDE.md#1-provider-source-management)

- [ ] **Promo Codes & Overrides Ready**
  - [ ] Team trained on override endpoint
  - [ ] Admin key distributed securely
  - [ ] See: [ADMIN_GUIDE.md](ADMIN_GUIDE.md#2-event-admin-overrides)

- [ ] **Logs & Monitoring**
  - [ ] Render dashboard bookmarked for quick status checks
  - [ ] Supabase dashboard bookmarked for database queries
  - [ ] Team has SQL access for provider stats

---

## Rollback Plan (if needed)

If production breaks:

1. **Immediate:** Pause `mmw-live-map-ingest-cron` in Render
2. **Fallback:** Roll back web service to previous successful deploy in Render
3. **Manual rollback:** Use Render service deploy history and redeploy prior version
4. **Debug:** Check logs in Render and Supabase to identify root cause

---

## Docs Reference

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Project overview + tech stack |
| [SUPABASE_SETUP.md](SUPABASE_SETUP.md) | Supabase account → production |
| [ADMIN_GUIDE.md](ADMIN_GUIDE.md) | Admin workflows (URLs, overrides, leads) |
| [TESTING_GUIDE.md](TESTING_GUIDE.md) | Local testing with curl |
| [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) | This file |

---

## Success Criteria

Your deployment is **live and ready** when:

✅ `/api/events` returns event data (200 OK)  
✅ `/api/bootstrap` ingests seed events (201 Created)  
✅ `/api/admin/ingest` accepts requests with valid admin key (200 OK)  
✅ `/api/admin/events/[id]/override` patches event metadata (200 OK)  
✅ Cron job runs automatically every 30 minutes (Render cron logs show executions)  
✅ Supabase database contains events, artists, connections, and leads  
✅ Zero 5xx errors in Render logs over 24-hour period  

---

**Questions?** See [ADMIN_GUIDE.md](ADMIN_GUIDE.md) or [TESTING_GUIDE.md](TESTING_GUIDE.md) troubleshooting sections.

**Ready to ship?** Follow this checklist in order, then deploy. Production is 30 minutes away.
