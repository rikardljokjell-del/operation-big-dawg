alter table public.gym_player_state
  add column if not exists pending_victory_cycle integer,
  add column if not exists pending_victory_leader smallint,
  add column if not exists pending_victory_loot smallint[] not null default '{}'::smallint[],
  add column if not exists pending_victory_resolved_at timestamptz,
  add column if not exists pending_victory_awards smallint[] not null default '{}'::smallint[],
  add column if not exists pending_victory_shuffle smallint[] not null default '{}'::smallint[],
  add column if not exists pending_victory_snipe_target smallint,
  add column if not exists pending_victory_snipe_success boolean;

create table if not exists public.wild_pokemon_state (
  player_id uuid primary key references public.players(id) on delete cascade,
  status text not null default 'active' check (status in ('active','cooldown')),
  pokemon_id smallint check (pokemon_id between 1 and 151),
  appeared_at timestamptz,
  expires_at timestamptz,
  next_spawn_at timestamptz,
  attempt_workout_id uuid references public.workouts(id) on delete set null,
  last_result_pokemon smallint check (last_result_pokemon between 1 and 151),
  last_catch_success boolean,
  last_outcome text check (last_outcome in ('caught','missed','fled')),
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.wild_pokemon_state enable row level security;
revoke all on public.wild_pokemon_state from anon, authenticated;
grant all on public.wild_pokemon_state to service_role;
