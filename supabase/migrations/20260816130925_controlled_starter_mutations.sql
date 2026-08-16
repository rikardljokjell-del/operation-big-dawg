-- Keep starter choices immutable for normal writes, while allowing the two
-- audited service-role operations that must intentionally restore/change one.

create or replace function public.lock_starter_pokemon_choice()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('obd.allow_starter_mutation', true) = 'on' then
    return new;
  end if;
  if old.starter_pokemon is not null and new.starter_pokemon is distinct from old.starter_pokemon then
    raise exception 'starter_pokemon is permanent once chosen';
  end if;
  if old.starter_event_completed_at is not null and new.starter_event_completed_at is null then
    raise exception 'starter event completion is permanent';
  end if;
  return new;
end;
$$;

create or replace function public.reverse_workout_game_state(
  p_workout_id uuid,
  p_expected_player_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workout public.workouts%rowtype;
  v_snapshot public.workout_game_snapshots%rowtype;
  v_player_before public.players%rowtype;
  v_latest_workout_id uuid;
begin
  select * into v_workout from public.workouts where id = p_workout_id for update;
  if not found then
    return jsonb_build_object('ok', true, 'deleted', false, 'reason', 'NOT_FOUND');
  end if;
  if p_expected_player_id is not null and v_workout.player_id <> p_expected_player_id then
    raise exception 'WORKOUT_PLAYER_MISMATCH';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_workout.player_id::text, 0));
  select id into v_latest_workout_id from public.workouts
  where player_id = v_workout.player_id order by created_at desc, id desc limit 1;
  if v_latest_workout_id <> v_workout.id then raise exception 'ONLY_LATEST_REVERSIBLE'; end if;

  select * into v_snapshot from public.workout_game_snapshots
  where workout_id = v_workout.id for update;
  if not found then raise exception 'LEGACY_WORKOUT_NO_SNAPSHOT'; end if;

  select * into v_player_before
  from jsonb_populate_record(null::public.players, v_snapshot.player_before);
  perform set_config('obd.allow_starter_mutation', 'on', true);
  update public.players
  set starter_pokemon = v_player_before.starter_pokemon,
      starter_event_triggered_at = v_player_before.starter_event_triggered_at,
      starter_event_completed_at = v_player_before.starter_event_completed_at,
      stats_alloc = v_player_before.stats_alloc,
      stats_build_open_level = v_player_before.stats_build_open_level,
      stats_build_saved_level = v_player_before.stats_build_saved_level,
      updated_at = now()
  where id = v_workout.player_id;
  perform set_config('obd.allow_starter_mutation', 'off', true);

  delete from public.gym_player_state where player_id = v_workout.player_id;
  if v_snapshot.gym_before is not null then
    insert into public.gym_player_state
    select (jsonb_populate_record(null::public.gym_player_state, v_snapshot.gym_before)).*;
  end if;
  delete from public.wild_pokemon_state where player_id = v_workout.player_id;
  if v_snapshot.wild_before is not null then
    insert into public.wild_pokemon_state
    select (jsonb_populate_record(null::public.wild_pokemon_state, v_snapshot.wild_before)).*;
  end if;

  delete from public.gym_weekly_events
  where player_id = v_workout.player_id and occurred_at >= v_snapshot.created_at;
  delete from public.wild_catch_events where workout_id = v_workout.id;
  delete from public.workout_reward_claims where first_workout_id = v_workout.id;
  delete from public.workouts where id = v_workout.id;

  return jsonb_build_object(
    'ok', true, 'deleted', true, 'reversed', true,
    'reversed_effects', jsonb_build_array('xp', 'starter', 'gym', 'gymdex', 'wild', 'stats')
  );
end;
$$;

create or replace function public.admin_apply_starter_change(
  p_player_id uuid,
  p_next_starter smallint,
  p_owned_pokemon smallint[],
  p_active_party smallint[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_next_starter not in (1, 4, 7) then raise exception 'INVALID_STARTER'; end if;
  if not (p_next_starter = any(p_owned_pokemon)) or not (p_next_starter = any(p_active_party)) then
    raise exception 'STARTER_MUST_BE_OWNED_AND_ACTIVE';
  end if;
  if cardinality(p_active_party) > 6 then raise exception 'ACTIVE_PARTY_LIMIT'; end if;
  if not exists(select 1 from public.players where id = p_player_id) then raise exception 'PLAYER_NOT_FOUND'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_player_id::text, 0));
  perform set_config('obd.allow_starter_mutation', 'on', true);
  update public.players
  set starter_pokemon = p_next_starter,
      starter_event_triggered_at = coalesce(starter_event_triggered_at, now()),
      starter_event_completed_at = coalesce(starter_event_completed_at, now()),
      updated_at = now()
  where id = p_player_id;
  perform set_config('obd.allow_starter_mutation', 'off', true);

  insert into public.gym_player_state(player_id, owned_pokemon, active_party)
  values (p_player_id, p_owned_pokemon, p_active_party)
  on conflict (player_id) do update
    set owned_pokemon = excluded.owned_pokemon,
        active_party = excluded.active_party,
        updated_at = now();
end;
$$;

create or replace function public.admin_reset_player_game(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists(select 1 from public.players where id = p_player_id) then raise exception 'PLAYER_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_player_id::text, 0));
  perform set_config('obd.allow_starter_mutation', 'on', true);
  update public.players
  set starter_pokemon = null,
      starter_event_triggered_at = null,
      starter_event_completed_at = null,
      stats_alloc = '{"grit":0,"power":0,"engine":0,"discipline":0}'::jsonb,
      stats_build_open_level = null,
      stats_build_saved_level = null,
      updated_at = now()
  where id = p_player_id;
  perform set_config('obd.allow_starter_mutation', 'off', true);
  delete from public.gym_player_state where player_id = p_player_id;
  delete from public.wild_pokemon_state where player_id = p_player_id;
end;
$$;

revoke all on function public.reverse_workout_game_state(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_apply_starter_change(uuid, smallint, smallint[], smallint[]) from public, anon, authenticated;
revoke all on function public.admin_reset_player_game(uuid) from public, anon, authenticated;
grant execute on function public.reverse_workout_game_state(uuid, uuid) to service_role;
grant execute on function public.admin_apply_starter_change(uuid, smallint, smallint[], smallint[]) to service_role;
grant execute on function public.admin_reset_player_game(uuid) to service_role;

comment on function public.admin_apply_starter_change(uuid, smallint, smallint[], smallint[]) is
  'Service-only starter replacement used by the audited admin console.';
comment on function public.admin_reset_player_game(uuid) is
  'Service-only reset of starter, Gym, Wild and allocated game stats; workouts are preserved.';
