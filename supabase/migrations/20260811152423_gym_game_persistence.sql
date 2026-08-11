create table public.gym_global_state (
  id smallint primary key default 1 check (id = 1),
  week_key date not null,
  leader_index smallint not null default 0 check (leader_index between 0 and 7),
  initial_round_complete boolean not null default false,
  cycle integer not null default 1 check (cycle > 0),
  damage integer not null default 0 check (damage >= 0),
  defeated boolean not null default false,
  contributors jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

create table public.gym_player_state (
  player_id uuid primary key references public.players(id) on delete cascade,
  seen_leaders smallint[] not null default '{}'::smallint[],
  defeated_leaders smallint[] not null default '{}'::smallint[],
  owned_pokemon smallint[] not null default '{}'::smallint[],
  active_party smallint[] not null default '{}'::smallint[],
  attacks text[] not null default array['basic']::text[],
  pending_attack text,
  current_cycle integer not null default 0,
  current_loot smallint[] not null default '{}'::smallint[],
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint gym_active_party_max_six check (cardinality(active_party) <= 6),
  constraint gym_attacks_max_three check (cardinality(attacks) <= 3)
);

create table public.gym_attack_claims (
  workout_id uuid primary key references public.workouts(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  cycle integer not null,
  created_at timestamptz not null default now()
);

create index gym_attack_claims_player_cycle_idx on public.gym_attack_claims(player_id, cycle);

alter table public.gym_global_state enable row level security;
alter table public.gym_player_state enable row level security;
alter table public.gym_attack_claims enable row level security;

insert into public.gym_global_state(id, week_key)
values (1, date_trunc('week', timezone('Europe/Oslo', now()))::date)
on conflict (id) do nothing;
