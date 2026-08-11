alter table public.players
  add constraint players_pin_not_onboarding
  check (pin <> '0007');
