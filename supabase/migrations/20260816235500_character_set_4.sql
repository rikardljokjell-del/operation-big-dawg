alter table public.players drop constraint if exists players_character_set_valid;

alter table public.players
  add constraint players_character_set_valid
  check (character_set = any (array[1,2,3,4]));
