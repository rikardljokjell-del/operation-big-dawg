# Operation Big Dawg

Workout motivational game tracker. EPIC characters

## Deployment workflow

- `main` is the production baseline.
- New changes should be made on a feature branch.
- Vercel should create a Preview Deployment for feature branches.
- After testing, merge to `main` to publish to production.
- If a release breaks, revert the relevant commit and redeploy `main`.

## Frontend

Static app split into `index.html`, `style.css`, `core.js`, `characters.js`, and `ui.js`.

## Backend

Supabase Edge Function source is stored in:

`supabase/functions/training-tracker/index.ts`

The production database is not stored in Git. Deploying frontend/backend code must not delete workout history.
