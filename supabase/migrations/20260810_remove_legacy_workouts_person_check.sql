-- Step 3 fix: remove the legacy two-player restriction.
-- Player identity is now enforced by workouts.player_id -> players.id.
-- Keep workout_type validation and all existing data intact.

alter table public.workouts
  drop constraint if exists workouts_person_check;
