-- Wild Pokémon must not exist or be catchable before the starter story is complete.

-- Undo any hidden pre-unlock catches created by the previous client flow.
update public.gym_player_state g
set owned_pokemon = coalesce((
      select array_agg(x order by x)
      from unnest(coalesce(g.owned_pokemon, '{}'::integer[])) as x
      where x <> w.last_result_pokemon
    ), '{}'::integer[]),
    active_party = coalesce((
      select array_agg(x order by ord)
      from unnest(coalesce(g.active_party, '{}'::integer[])) with ordinality as t(x, ord)
      where x <> w.last_result_pokemon
    ), '{}'::integer[]),
    updated_at = now()
from public.wild_pokemon_state w
join public.players p on p.id = w.player_id
where g.player_id = w.player_id
  and p.starter_event_completed_at is null
  and w.last_catch_success is true
  and w.last_result_pokemon is not null;

-- Remove all hidden encounters/cooldowns for players who have not unlocked Pokémon progression.
delete from public.wild_pokemon_state w
using public.players p
where p.id = w.player_id
  and p.starter_event_completed_at is null;

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
