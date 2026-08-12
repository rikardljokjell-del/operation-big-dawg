alter table public.gym_player_state
  add column if not exists first_gym_fight_at timestamptz,
  add column if not exists gymdex_unlocked_at timestamptz;

-- Do not retro-trigger the new onboarding sequence for players who already
-- fought a Gym Leader before this feature existed.
update public.gym_player_state
set first_gym_fight_at = coalesce(first_gym_fight_at, updated_at),
    gymdex_unlocked_at = coalesce(gymdex_unlocked_at, updated_at)
where first_gym_fight_at is null
  and (
    coalesce(damage, 0) > 0
    or coalesce(cardinality(defeated_leaders), 0) > 0
    or leader_defeated = true
  );
