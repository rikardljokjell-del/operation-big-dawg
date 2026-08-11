alter table public.players
  add column if not exists starter_pokemon smallint,
  add column if not exists starter_event_triggered_at timestamptz,
  add column if not exists starter_event_completed_at timestamptz;

alter table public.players
  drop constraint if exists players_starter_pokemon_check;

alter table public.players
  add constraint players_starter_pokemon_check
  check (starter_pokemon is null or starter_pokemon in (1,4,7));
