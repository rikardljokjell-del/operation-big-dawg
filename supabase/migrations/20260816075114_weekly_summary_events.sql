-- Weekly Summary is generated on demand for the latest completed Oslo week.
-- These tables are private implementation details: the browser only reaches
-- them through the weekly-summary Edge Function.

create table if not exists public.weekly_summary_deliveries (
  viewer_player_id uuid not null references public.players(id) on delete cascade,
  week_start date not null,
  selected_player_ids uuid[] not null,
  snapshot jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  dismissed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (viewer_player_id, week_start),
  constraint weekly_summary_week_is_monday
    check (extract(isodow from week_start) = 1),
  constraint weekly_summary_players_one_to_six
    check (cardinality(selected_player_ids) between 1 and 6),
  constraint weekly_summary_snapshot_object
    check (jsonb_typeof(snapshot) = 'object')
);

comment on table public.weekly_summary_deliveries is
  'One stable Weekly Summary snapshot per viewer and completed week. Dismissal is synchronized across devices.';

create table if not exists public.gym_weekly_events (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  cycle integer not null check (cycle >= 0),
  leader smallint not null check (leader between 0 and 7),
  damage integer not null default 0 check (damage >= 0),
  boss_ko boolean not null default false,
  pokemon_id smallint check (pokemon_id between 1 and 151),
  steal_method text check (steal_method in ('snipe', 'random_shuffle')),
  occurred_at timestamptz not null default now(),
  event_key text not null unique,
  constraint gym_weekly_event_has_payload
    check (damage > 0 or boss_ko or pokemon_id is not null),
  constraint gym_weekly_steal_method_consistent
    check (
      (pokemon_id is null and steal_method is null)
      or (pokemon_id is not null and steal_method is not null)
    )
);

comment on table public.gym_weekly_events is
  'Append-only Gym damage, KO and Pokemon steal events used by Weekly Summary.';

create table if not exists public.wild_catch_events (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  workout_id uuid references public.workouts(id) on delete set null,
  pokemon_id smallint not null check (pokemon_id between 1 and 151),
  captured_at timestamptz not null default now(),
  event_key text not null unique
);

comment on table public.wild_catch_events is
  'Append-only successful Wild Pokemon catches. Failed attempts are deliberately excluded.';

create index if not exists gym_weekly_events_player_occurred_idx
  on public.gym_weekly_events (player_id, occurred_at desc);

create index if not exists wild_catch_events_player_captured_idx
  on public.wild_catch_events (player_id, captured_at desc);

create index if not exists wild_catch_events_workout_idx
  on public.wild_catch_events (workout_id)
  where workout_id is not null;

alter table public.weekly_summary_deliveries enable row level security;
alter table public.gym_weekly_events enable row level security;
alter table public.wild_catch_events enable row level security;

revoke all on table public.weekly_summary_deliveries from anon, authenticated;
revoke all on table public.gym_weekly_events from anon, authenticated;
revoke all on table public.wild_catch_events from anon, authenticated;

grant select, insert, update on table public.weekly_summary_deliveries to service_role;
grant select, insert on table public.gym_weekly_events to service_role;
grant select, insert on table public.wild_catch_events to service_role;
grant usage, select on sequence public.gym_weekly_events_id_seq to service_role;
grant usage, select on sequence public.wild_catch_events_id_seq to service_role;

drop policy if exists weekly_summary_service_role on public.weekly_summary_deliveries;
create policy weekly_summary_service_role
on public.weekly_summary_deliveries
for all
to service_role
using (true)
with check (true);

drop policy if exists gym_weekly_events_service_role on public.gym_weekly_events;
create policy gym_weekly_events_service_role
on public.gym_weekly_events
for all
to service_role
using (true)
with check (true);

drop policy if exists wild_catch_events_service_role on public.wild_catch_events;
create policy wild_catch_events_service_role
on public.wild_catch_events
for all
to service_role
using (true)
with check (true);

create or replace function public.capture_gym_weekly_events()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pokemon smallint;
  method text;
begin
  if new.damage > old.damage then
    insert into public.gym_weekly_events (
      player_id,
      cycle,
      leader,
      damage,
      boss_ko,
      occurred_at,
      event_key
    ) values (
      new.player_id,
      greatest(0, new.current_cycle),
      new.current_leader,
      new.damage - old.damage,
      (not old.leader_defeated and new.leader_defeated),
      coalesce(new.updated_at, now()),
      concat('gym:', new.player_id, ':v', new.version, ':damage')
    )
    on conflict (event_key) do nothing;
  end if;

  if new.pending_victory_resolved_at is not null
     and new.pending_victory_resolved_at is distinct from old.pending_victory_resolved_at then
    foreach pokemon in array coalesce(new.pending_victory_awards, '{}'::smallint[])
    loop
      method := case
        when new.pending_victory_snipe_success is true
          and pokemon = new.pending_victory_snipe_target
          then 'snipe'
        else 'random_shuffle'
      end;

      insert into public.gym_weekly_events (
        player_id,
        cycle,
        leader,
        pokemon_id,
        steal_method,
        occurred_at,
        event_key
      ) values (
        new.player_id,
        greatest(0, coalesce(new.pending_victory_cycle, new.current_cycle)),
        coalesce(new.pending_victory_leader, new.current_leader),
        pokemon,
        method,
        new.pending_victory_resolved_at,
        concat('gym:', new.player_id, ':v', new.version, ':steal:', pokemon)
      )
      on conflict (event_key) do nothing;
    end loop;
  end if;

  return new;
end;
$$;

revoke all on function public.capture_gym_weekly_events() from public, anon, authenticated;
grant execute on function public.capture_gym_weekly_events() to service_role;

drop trigger if exists gym_player_state_capture_weekly_events on public.gym_player_state;
create trigger gym_player_state_capture_weekly_events
after update on public.gym_player_state
for each row
execute function public.capture_gym_weekly_events();

create or replace function public.capture_wild_catch_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'cooldown'
     and new.last_outcome = 'caught'
     and new.last_catch_success is true
     and new.last_result_pokemon is not null
     and new.attempt_workout_id is not null
     and new.attempt_workout_id is distinct from old.attempt_workout_id then
    insert into public.wild_catch_events (
      player_id,
      workout_id,
      pokemon_id,
      captured_at,
      event_key
    ) values (
      new.player_id,
      new.attempt_workout_id,
      new.last_result_pokemon,
      coalesce(new.updated_at, now()),
      concat('wild:', new.player_id, ':', new.attempt_workout_id)
    )
    on conflict (event_key) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.capture_wild_catch_event() from public, anon, authenticated;
grant execute on function public.capture_wild_catch_event() to service_role;

drop trigger if exists wild_pokemon_state_capture_catch on public.wild_pokemon_state;
create trigger wild_pokemon_state_capture_catch
after update on public.wild_pokemon_state
for each row
execute function public.capture_wild_catch_event();

-- A currently visible, successful cooldown row contains enough information for
-- a precise one-time backfill. Active encounters intentionally are not guessed.
insert into public.wild_catch_events (
  player_id,
  workout_id,
  pokemon_id,
  captured_at,
  event_key
)
select
  player_id,
  attempt_workout_id,
  last_result_pokemon,
  updated_at,
  concat('wild:', player_id, ':', attempt_workout_id)
from public.wild_pokemon_state
where status = 'cooldown'
  and last_outcome = 'caught'
  and last_catch_success is true
  and last_result_pokemon is not null
  and attempt_workout_id is not null
on conflict (event_key) do nothing;
