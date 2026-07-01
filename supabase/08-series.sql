-- 08-series.sql — 'series' tracker type: an ordered checklist of steps that
-- resets daily (e.g. a night routine). Steps live in tracker_steps; a checked
-- step on a given day is an entry row tagged with that step_id.
-- Run once on the existing project (after 07-sections.sql).

create table if not exists tracker_steps (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade default auth.uid(),
  tracker_id uuid not null references trackers(id) on delete cascade,
  label      text not null check (char_length(label) between 1 and 120),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists tracker_steps_tracker_idx on tracker_steps (tracker_id);

-- A checked step on a day. Null for non-series entries (existing behavior).
alter table entries
  add column if not exists step_id uuid references tracker_steps(id) on delete cascade;
create index if not exists entries_step_idx on entries (step_id);

-- Allow the new tracker type. Drop the deterministically-named column check
-- and recreate it (see 06-measure.sql for the IN→=ANY gotcha).
alter table trackers drop constraint if exists trackers_type_check;
alter table trackers add constraint trackers_type_check
  check (type in ('yesno', 'count', 'measure', 'series'));

alter table tracker_steps enable row level security;
drop policy if exists tracker_steps_own on tracker_steps;
create policy tracker_steps_own on tracker_steps
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
