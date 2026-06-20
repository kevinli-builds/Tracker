-- Tracker — full schema for a fresh Supabase project.
-- Run this once in the Supabase SQL editor.
--
-- Single-user app for now: there is no auth, and RLS policies grant the anon
-- key full read/write. To make it multi-user later, add a `user_id uuid`
-- column referencing auth.users on both tables and tighten the policies to
-- `auth.uid() = user_id`.

-- ---------------------------------------------------------------------------
-- trackers: one row per thing you want to track.
-- ---------------------------------------------------------------------------
create table if not exists trackers (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 1 and 80),
  -- 'yesno'  : a day is either done or not (at most one entry per day)
  -- 'count'  : tally taps within a day (a day's value is SUM of its entries)
  type           text not null check (type in ('yesno', 'count')),
  color          text not null default '#6366f1' check (color ~ '^#[0-9a-fA-F]{6}$'),
  emoji          text not null default '✅' check (char_length(emoji) <= 8),
  unit           text check (unit is null or char_length(unit) <= 24),
  -- 'more'  : logging more is good (e.g. chia seeds)        → good day = any log
  -- 'less'  : you want to avoid this (e.g. drinks)          → good day = zero
  -- 'neutral': just counting                                → good day = any log
  goal_direction text not null default 'neutral' check (goal_direction in ('more', 'less', 'neutral')),
  sort_order     int not null default 0,
  archived       boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- entries: one row per tap. day is the user's LOCAL calendar date.
-- ---------------------------------------------------------------------------
create table if not exists entries (
  id         uuid primary key default gen_random_uuid(),
  tracker_id uuid not null references trackers(id) on delete cascade,
  day        date not null,
  value      int not null default 1 check (value <> 0),
  logged_at  timestamptz not null default now()
);

create index if not exists entries_tracker_day_idx on entries (tracker_id, day);
create index if not exists entries_day_idx on entries (day);

-- ---------------------------------------------------------------------------
-- Row Level Security — single-user, anon key gets full access.
-- ---------------------------------------------------------------------------
alter table trackers enable row level security;
alter table entries  enable row level security;

drop policy if exists trackers_all on trackers;
create policy trackers_all on trackers
  for all to anon, authenticated
  using (true) with check (true);

drop policy if exists entries_all on entries;
create policy entries_all on entries
  for all to anon, authenticated
  using (true) with check (true);
