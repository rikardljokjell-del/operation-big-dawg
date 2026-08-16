-- Reverse a rewarded workout and its game consequences as one transaction.

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
  select * into v_workout
  from public.workouts
  where id = p_workout_id
  for update;

  if not found then
    return jsonb_build_object('ok', true, 'deleted', false, 'reason', 'NOT_FOUND');
  end if;

  if p_expected_player_id is not null and v_workout.player_id <> p_expected_player_id then
    raise exception 'WORKOUT_PLAYER_MISMATCH';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_workout.player_id::text, 0));

  select id into v_latest_workout_id
  from public.workouts
  where player_id = v_workout.player_id
  order by created_at desc, id desc
  limit 1;

  if v_latest_workout_id <> v_workout.id then
    raise exception 'ONLY_LATEST_REVERSIBLE';
  end if;

  select * into v_snapshot
  from public.workout_game_snapshots
  where workout_id = v_workout.id
  for update;

  if not found then
    raise exception 'LEGACY_WORKOUT_NO_SNAPSHOT';
  end if;

  select * into v_player_before
  from jsonb_populate_record(null::public.players, v_snapshot.player_before);

  update public.players
  set starter_pokemon = v_player_before.starter_pokemon,
      starter_event_triggered_at = v_player_before.starter_event_triggered_at,
      starter_event_completed_at = v_player_before.starter_event_completed_at,
      stats_alloc = v_player_before.stats_alloc,
      stats_build_open_level = v_player_before.stats_build_open_level,
      stats_build_saved_level = v_player_before.stats_build_saved_level,
      updated_at = now()
  where id = v_workout.player_id;

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
  where player_id = v_workout.player_id
    and occurred_at >= v_snapshot.created_at;

  delete from public.wild_catch_events where workout_id = v_workout.id;
  delete from public.workout_reward_claims where first_workout_id = v_workout.id;
  delete from public.workouts where id = v_workout.id;

  return jsonb_build_object(
    'ok', true,
    'deleted', true,
    'reversed', true,
    'reversed_effects', jsonb_build_array('xp', 'starter', 'gym', 'gymdex', 'wild', 'stats')
  );
end;
$$;

revoke all on function public.reverse_workout_game_state(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reverse_workout_game_state(uuid, uuid) to service_role;

comment on function public.reverse_workout_game_state(uuid, uuid) is
  'Atomically restores the checkpoint for the latest workout, removes its claims/events, and deletes the workout.';
