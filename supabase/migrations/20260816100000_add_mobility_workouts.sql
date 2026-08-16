alter table public.workouts
  drop constraint workouts_workout_type_check,
  add constraint workouts_workout_type_check
    check (workout_type in ('strength', 'cardio', 'mobility'));

alter table public.manual_workouts
  drop constraint manual_workouts_workout_type_check,
  add constraint manual_workouts_workout_type_check
    check (workout_type in ('strength', 'cardio', 'mobility'));

alter table public.workout_reward_claims
  drop constraint workout_reward_claims_workout_type_check,
  add constraint workout_reward_claims_workout_type_check
    check (workout_type in ('strength', 'cardio', 'mobility'));
