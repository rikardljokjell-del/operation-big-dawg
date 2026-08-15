-- Manual history is deliberately isolated from public.workouts so it can be
-- shown in the calendar/log without ever feeding XP or other game systems.
create table if not exists public.manual_workouts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  workout_type text not null check (workout_type in ('strength', 'cardio')),
  workout_date date not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manual_workouts_player_day_type_unique
    unique (player_id, workout_date, workout_type)
);

comment on table public.manual_workouts is
  'History-only workouts. Never use these rows for XP, AP, streaks, battles, stats, bosses, or other game rewards.';

alter table public.manual_workouts enable row level security;

revoke all on table public.manual_workouts from anon, authenticated;
grant select, insert, update, delete on table public.manual_workouts to service_role;

create index if not exists manual_workouts_player_occurred_at_idx
  on public.manual_workouts (player_id, occurred_at desc);

create or replace function public.validate_manual_workout()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  oslo_date date := (new.occurred_at at time zone 'Europe/Oslo')::date;
  oslo_today date := (now() at time zone 'Europe/Oslo')::date;
begin
  if new.workout_date <> oslo_date then
    raise exception using
      errcode = '23514',
      message = 'MANUAL_DATE_MISMATCH';
  end if;

  if new.workout_date >= oslo_today then
    raise exception using
      errcode = '23514',
      message = 'MANUAL_DATE_NOT_HISTORICAL';
  end if;

  if exists (
    select 1
    from public.workouts w
    where w.player_id = new.player_id
      and w.workout_type = new.workout_type
      and (w.created_at at time zone 'Europe/Oslo')::date = new.workout_date
  ) then
    raise exception using
      errcode = '23505',
      message = 'DAILY_TYPE_LIMIT';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.validate_manual_workout() from public, anon, authenticated;
grant execute on function public.validate_manual_workout() to service_role;

drop trigger if exists manual_workouts_validate on public.manual_workouts;
create trigger manual_workouts_validate
before insert or update
on public.manual_workouts
for each row
execute function public.validate_manual_workout();

create or replace function public.prevent_regular_manual_duplicate()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  oslo_date date := (new.created_at at time zone 'Europe/Oslo')::date;
begin
  if exists (
    select 1
    from public.manual_workouts mw
    where mw.player_id = new.player_id
      and mw.workout_type = new.workout_type
      and mw.workout_date = oslo_date
  ) then
    raise exception using
      errcode = '23505',
      message = 'DAILY_TYPE_LIMIT';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_regular_manual_duplicate() from public, anon, authenticated;
grant execute on function public.prevent_regular_manual_duplicate() to service_role;

drop trigger if exists workouts_prevent_manual_duplicate on public.workouts;
create trigger workouts_prevent_manual_duplicate
before insert or update of player_id, workout_type, created_at
on public.workouts
for each row
execute function public.prevent_regular_manual_duplicate();
