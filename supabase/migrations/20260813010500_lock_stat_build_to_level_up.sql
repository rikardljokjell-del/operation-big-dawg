alter table public.players
  add column if not exists stats_build_open_level integer,
  add column if not exists stats_build_saved_level integer;

alter table public.players
  drop constraint if exists players_stats_build_open_level_check;
alter table public.players
  add constraint players_stats_build_open_level_check
  check (stats_build_open_level is null or stats_build_open_level >= 2);

alter table public.players
  drop constraint if exists players_stats_build_saved_level_check;
alter table public.players
  add constraint players_stats_build_saved_level_check
  check (stats_build_saved_level is null or stats_build_saved_level >= 2);
