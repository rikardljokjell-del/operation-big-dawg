-- Stats Unlock: persist only player-assigned attribute points.
-- Workout-derived and level-derived stats are calculated from existing history/XP.

alter table public.players
  add column if not exists stats_alloc jsonb not null
  default '{"power":0,"engine":0,"discipline":0,"grit":0}'::jsonb;

alter table public.players
  drop constraint if exists players_stats_alloc_valid;

alter table public.players
  add constraint players_stats_alloc_valid check (
    jsonb_typeof(stats_alloc) = 'object'
    and coalesce((stats_alloc->>'power')::int, 0) >= 0
    and coalesce((stats_alloc->>'engine')::int, 0) >= 0
    and coalesce((stats_alloc->>'discipline')::int, 0) >= 0
    and coalesce((stats_alloc->>'grit')::int, 0) >= 0
    and (
      coalesce((stats_alloc->>'power')::int, 0)
      + coalesce((stats_alloc->>'engine')::int, 0)
      + coalesce((stats_alloc->>'discipline')::int, 0)
      + coalesce((stats_alloc->>'grit')::int, 0)
    ) <= 19
  );