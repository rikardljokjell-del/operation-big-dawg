create or replace function public.arm_starter_on_fourth_workout()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.players p
  set starter_event_triggered_at = coalesce(p.starter_event_triggered_at, now())
  where p.id = new.player_id
    and p.starter_event_completed_at is null
    and (select count(*) from public.workouts w where w.player_id = new.player_id) >= 4;
  return new;
end;
$$;

drop trigger if exists trg_arm_starter_on_fourth_workout on public.workouts;
create trigger trg_arm_starter_on_fourth_workout
after insert on public.workouts
for each row execute function public.arm_starter_on_fourth_workout();
