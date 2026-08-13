-- Wild Pokémon must not exist or be catchable before the starter story is complete.

create or replace function public.enforce_wild_pokemon_unlocked()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.players p
    where p.id = new.player_id
      and p.starter_event_completed_at is not null
  ) then
    raise exception 'Wild Pokemon is locked until the starter event is complete';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_wild_pokemon_unlocked() from public, anon, authenticated;

drop trigger if exists wild_pokemon_requires_starter on public.wild_pokemon_state;
create trigger wild_pokemon_requires_starter
before insert or update on public.wild_pokemon_state
for each row execute function public.enforce_wild_pokemon_unlocked();
