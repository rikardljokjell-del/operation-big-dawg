-- Permanent per-player/day/type claim for irreversible workout rewards.
-- Claims intentionally survive workout undo/delete: first_workout_id becomes NULL.

create table if not exists public.workout_reward_claims (
  player_id uuid not null references public.players(id) on delete cascade,
  reward_date date not null,
  workout_type text not null check (workout_type in ('strength','cardio')),
  first_workout_id uuid references public.workouts(id) on delete set null,
  claimed_at timestamptz not null default now(),
  primary key (player_id, reward_date, workout_type)
);

alter table public.workout_reward_claims enable row level security;
revoke all on table public.workout_reward_claims from anon, authenticated;
grant select, insert, delete on table public.workout_reward_claims to service_role;

create index if not exists workout_reward_claims_date_idx
  on public.workout_reward_claims(reward_date);

-- Existing workouts count as already rewarded so deployment cannot create a
-- one-day re-claim window for users who already trained today.
insert into public.workout_reward_claims (
  player_id,
  reward_date,
  workout_type,
  first_workout_id,
  claimed_at
)
select distinct on (
  w.player_id,
  (w.created_at at time zone 'Europe/Oslo')::date,
  w.workout_type
)
  w.player_id,
  (w.created_at at time zone 'Europe/Oslo')::date,
  w.workout_type,
  w.id,
  w.created_at
from public.workouts w
where w.workout_type in ('strength','cardio')
order by
  w.player_id,
  (w.created_at at time zone 'Europe/Oslo')::date,
  w.workout_type,
  w.created_at asc
on conflict (player_id, reward_date, workout_type) do nothing;
