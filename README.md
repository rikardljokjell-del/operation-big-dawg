# Operation Big Dawg

Workout motivational game tracker. EPIC characters

## Deployment workflow

- `main` is the production baseline.
- New changes should be made on a feature branch.
- Vercel should create a Preview Deployment for feature branches.
- After testing, merge to `main` to publish to production.
- If a release breaks, revert the relevant commit and redeploy `main`.

## Frontend

Static app split into `index.html` and feature-specific CSS/JavaScript files. The
Weekly Summary UI lives in `weekly-summary.css` and `weekly-summary.js`.

## Backend

Supabase Edge Function sources are stored in `supabase/functions/`. Weekly
Summary is served by:

`supabase/functions/weekly-summary/index.ts`

Its private delivery and gameplay-event tables are defined by:

`supabase/migrations/20260816075114_weekly_summary_events.sql`

Gym and wild-catch history is collected from the time this migration is
deployed. The migration only backfills a currently visible, successful wild
catch when it can do so without guessing.

The production database is not stored in Git. Deploying frontend/backend code must not delete workout history.
