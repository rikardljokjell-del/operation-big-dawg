-- Step 1: dynamic player model, backwards-compatible with the current frontend.
-- Character set mapping preserves the existing art:
--   1 = legacy Adrian character set
--   2 = legacy Rikard character set

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  character_set smallint not null default 1,
  pin text not null default '1337',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint players_name_not_blank check (length(btrim(name)) > 0),
  constraint players_character_set_valid check (character_set in (1, 2)),
  constraint players_pin_four_digits check (pin ~ '^[0-9]{4}$')
);

create unique index if not exists players_name_unique_ci
  on public.players ((lower(btrim(name))));

alter table public.players enable row level security;

-- Preserve today's two known characters even if one has no workouts yet.
insert into public.players (name, character_set, pin)
values
  ('Adrian', 1, '1337'),
  ('Rikard', 2, '1337')
on conflict do nothing;

-- Preserve any unexpected legacy person names rather than orphaning history.
insert into public.players (name, character_set, pin)
select distinct btrim(w.person), 1, '1337'
from public.workouts w
where length(btrim(w.person)) > 0
  and not exists (
    select 1 from public.players p
    where lower(btrim(p.name)) = lower(btrim(w.person))
  );

alter table public.workouts
  add column if not exists player_id uuid;

update public.workouts w
set player_id = p.id
from public.players p
where w.player_id is null
  and lower(btrim(w.person)) = lower(btrim(p.name));

-- Keep legacy `person` and new `player_id` synchronized during steps 2-3.
create or replace function public.sync_workout_player()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_id uuid;
  resolved_name text;
begin
  if new.player_id is not null then
    select p.id, p.name
      into resolved_id, resolved_name
    from public.players p
    where p.id = new.player_id;
  elsif new.person is not null then
    select p.id, p.name
      into resolved_id, resolved_name
    from public.players p
    where lower(btrim(p.name)) = lower(btrim(new.person))
    limit 1;
  end if;

  if resolved_id is null then
    raise exception 'Unknown player';
  end if;

  new.player_id := resolved_id;
  new.person := resolved_name;
  return new;
end;
$$;

drop trigger if exists workouts_sync_player on public.workouts;
create trigger workouts_sync_player
before insert or update of player_id, person
on public.workouts
for each row
execute function public.sync_workout_player();

do $$
begin
  if exists (select 1 from public.workouts where player_id is null) then
    raise exception 'Player migration failed: workouts without player_id remain';
  end if;
end;
$$;

alter table public.workouts
  alter column player_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workouts_player_id_fkey'
      and conrelid = 'public.workouts'::regclass
  ) then
    alter table public.workouts
      add constraint workouts_player_id_fkey
      foreign key (player_id)
      references public.players(id)
      on delete cascade;
  end if;
end;
$$;

create index if not exists workouts_player_id_created_at_idx
  on public.workouts (player_id, created_at desc);

create or replace function public.set_player_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists players_set_updated_at on public.players;
create trigger players_set_updated_at
before update on public.players
for each row
execute function public.set_player_updated_at();
