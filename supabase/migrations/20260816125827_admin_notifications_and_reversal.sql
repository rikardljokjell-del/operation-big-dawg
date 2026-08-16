-- Preview-safe support for reversible workout rewards and live admin notices.
-- This migration is additive and does not mutate existing player progression.

create table if not exists public.workout_game_snapshots (
  workout_id uuid primary key references public.workouts(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  player_before jsonb not null default '{}'::jsonb,
  gym_before jsonb,
  wild_before jsonb,
  created_at timestamptz not null default now(),
  constraint workout_game_snapshots_player_object
    check (jsonb_typeof(player_before) = 'object'),
  constraint workout_game_snapshots_gym_object
    check (gym_before is null or jsonb_typeof(gym_before) = 'object'),
  constraint workout_game_snapshots_wild_object
    check (wild_before is null or jsonb_typeof(wild_before) = 'object')
);

comment on table public.workout_game_snapshots is
  'Game-state checkpoint captured before a rewarded workout. Used to atomically reverse the latest workout and all consequences.';

create index if not exists workout_game_snapshots_player_created_idx
  on public.workout_game_snapshots (player_id, created_at desc);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  environment text not null default 'production'
    check (environment in ('preview', 'production')),
  title text not null check (char_length(trim(title)) between 1 and 100),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint admin_notifications_valid_window check (ends_at > starts_at)
);

comment on table public.admin_notifications is
  'Scheduled in-game dialog messages. Preview and production notices are isolated.';

create index if not exists admin_notifications_active_idx
  on public.admin_notifications (environment, starts_at, ends_at)
  where archived_at is null;

create table if not exists public.admin_notification_receipts (
  notification_id uuid not null references public.admin_notifications(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  primary key (notification_id, player_id)
);

create index if not exists admin_notification_receipts_player_idx
  on public.admin_notification_receipts (player_id, acknowledged_at desc);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_log_details_object check (jsonb_typeof(details) = 'object')
);

alter table public.workout_game_snapshots enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.admin_notification_receipts enable row level security;
alter table public.admin_audit_log enable row level security;

revoke all on table public.workout_game_snapshots from public, anon, authenticated;
revoke all on table public.admin_notifications from public, anon, authenticated;
revoke all on table public.admin_notification_receipts from public, anon, authenticated;
revoke all on table public.admin_audit_log from public, anon, authenticated;

grant select, insert, update, delete on table public.workout_game_snapshots to service_role;
grant select, insert, update, delete on table public.admin_notifications to service_role;
grant select, insert, update, delete on table public.admin_notification_receipts to service_role;
grant select, insert on table public.admin_audit_log to service_role;
grant usage, select on sequence public.admin_audit_log_id_seq to service_role;

drop policy if exists workout_game_snapshots_service_role on public.workout_game_snapshots;
create policy workout_game_snapshots_service_role
on public.workout_game_snapshots for all to service_role using (true) with check (true);

drop policy if exists admin_notifications_service_role on public.admin_notifications;
create policy admin_notifications_service_role
on public.admin_notifications for all to service_role using (true) with check (true);

drop policy if exists admin_notification_receipts_service_role on public.admin_notification_receipts;
create policy admin_notification_receipts_service_role
on public.admin_notification_receipts for all to service_role using (true) with check (true);

drop policy if exists admin_audit_log_service_role on public.admin_audit_log;
create policy admin_audit_log_service_role
on public.admin_audit_log for all to service_role using (true) with check (true);
