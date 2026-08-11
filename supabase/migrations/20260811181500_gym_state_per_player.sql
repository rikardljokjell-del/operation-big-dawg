alter table public.gym_player_state
  add column if not exists current_leader smallint not null default 0,
  add column if not exists initial_round_complete boolean not null default false,
  add column if not exists damage integer not null default 0,
  add column if not exists leader_defeated boolean not null default false;

alter table public.gym_player_state
  drop constraint if exists gym_player_state_current_leader_check;
alter table public.gym_player_state
  add constraint gym_player_state_current_leader_check check (current_leader between 0 and 7);

alter table public.gym_player_state
  drop constraint if exists gym_player_state_damage_check;
alter table public.gym_player_state
  add constraint gym_player_state_damage_check check (damage >= 0);
