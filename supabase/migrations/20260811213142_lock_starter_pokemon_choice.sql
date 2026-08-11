create or replace function public.lock_starter_pokemon_choice()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.starter_pokemon is not null and new.starter_pokemon is distinct from old.starter_pokemon then
    raise exception 'starter_pokemon is permanent once chosen';
  end if;
  if old.starter_event_completed_at is not null and new.starter_event_completed_at is null then
    raise exception 'starter event completion is permanent';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lock_starter_pokemon_choice on public.players;
create trigger trg_lock_starter_pokemon_choice
before update on public.players
for each row execute function public.lock_starter_pokemon_choice();
