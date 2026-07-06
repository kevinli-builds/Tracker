-- Tracker — full schema for a fresh Supabase project.
-- Run this once in the Supabase SQL editor.
--
-- Multi-user via Supabase Auth: every row is owned by a user (user_id), and RLS
-- scopes reads/writes to the signed-in user. (The original single-user version
-- was migrated to this by supabase/02-auth.sql.)

-- ---------------------------------------------------------------------------
-- sections: optional collapsible groups for the dashboard list. A tracker's
-- section_id points here (null = ungrouped, shown first).
-- ---------------------------------------------------------------------------
create table if not exists sections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade default auth.uid(),
  title      text not null check (char_length(title) between 1 and 80),
  sort_order int not null default 0,
  collapsed  boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists sections_user_idx on sections (user_id);

-- ---------------------------------------------------------------------------
-- trackers: one row per thing you want to track.
-- ---------------------------------------------------------------------------
create table if not exists trackers (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade default auth.uid(),
  section_id     uuid references sections(id) on delete set null,
  name           text not null check (char_length(name) between 1 and 80),
  -- optional one-line description shown under the name
  subtitle       text check (subtitle is null or char_length(subtitle) <= 200),
  -- 'yesno'  : a day is either done or not (at most one entry per day)
  -- 'count'  : tally taps within a day (a day's value is SUM of its entries)
  -- 'measure': a free-form numeric reading per day, e.g. weight (latest replaces;
  --            one entry per day, so the day's value is that single number)
  -- 'series' : an ordered checklist of steps that resets daily (tracker_steps);
  --            a checked step is an entry tagged with step_id (day total = #done)
  type           text not null check (type in ('yesno', 'count', 'measure', 'series')),
  color          text not null default '#6366f1' check (color ~ '^#[0-9a-fA-F]{6}$'),
  emoji          text not null default '✅' check (char_length(emoji) <= 8),
  unit           text check (unit is null or char_length(unit) <= 24),
  -- 'more'  : logging more is good (e.g. chia seeds)        → good day = any log
  -- 'less'  : you want to avoid this (e.g. drinks)          → good day = zero
  -- 'neutral': just counting                                → good day = any log
  goal_direction text not null default 'neutral' check (goal_direction in ('more', 'less', 'neutral')),
  -- which side the streak counts: 'did' = days logged, 'skipped' = clean days
  streak_side    text not null default 'did' check (streak_side in ('did', 'skipped')),
  -- optional numeric goal for the current period, e.g. "≥ 3 runs/week" ('more')
  -- or "≤ 2 drinks/week" ('less'); null = no target. Only used for count/yes-no.
  goal_target    numeric check (goal_target is null or goal_target > 0),
  goal_period    text check (goal_period is null or goal_period in ('day', 'week')),
  sort_order     int not null default 0,
  archived       boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tracker_steps: ordered steps for a 'series' tracker (e.g. night routine).
-- ---------------------------------------------------------------------------
create table if not exists tracker_steps (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade default auth.uid(),
  tracker_id uuid not null references trackers(id) on delete cascade,
  label      text not null check (char_length(label) between 1 and 120),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists tracker_steps_tracker_idx on tracker_steps (tracker_id);

-- ---------------------------------------------------------------------------
-- entries: one row per tap. day is the user's LOCAL calendar date.
-- ---------------------------------------------------------------------------
create table if not exists entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade default auth.uid(),
  tracker_id uuid not null references trackers(id) on delete cascade,
  -- set for a 'series' step check; null for yes-no/count/measure entries.
  step_id    uuid references tracker_steps(id) on delete cascade,
  day        date not null,
  -- numeric so 'measure' trackers can store decimals (e.g. weight 175.4);
  -- count/yes-no/series rows just use whole numbers.
  value      numeric not null default 1 check (value <> 0),
  logged_at  timestamptz not null default now()
);

create index if not exists entries_tracker_day_idx on entries (tracker_id, day);
create index if not exists entries_day_idx on entries (day);
create index if not exists entries_step_idx on entries (step_id);
create index if not exists trackers_user_idx on trackers (user_id);
create index if not exists entries_user_idx on entries (user_id);
create index if not exists trackers_section_idx on trackers (section_id);

-- ---------------------------------------------------------------------------
-- day_notes: an optional free-text note per tracker per day.
-- ---------------------------------------------------------------------------
create table if not exists day_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade default auth.uid(),
  tracker_id uuid not null references trackers(id) on delete cascade,
  day        date not null,
  note       text not null check (char_length(note) <= 2000),
  updated_at timestamptz not null default now(),
  unique (tracker_id, day)
);
create index if not exists day_notes_tracker_idx on day_notes (tracker_id);

-- ---------------------------------------------------------------------------
-- tracker_resources: reference material attached to a tracker itself — titled
-- links and free-text notes (vs day_notes, which are per-day).
-- ---------------------------------------------------------------------------
create table if not exists tracker_resources (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade default auth.uid(),
  tracker_id uuid not null references trackers(id) on delete cascade,
  kind       text not null check (kind in ('link', 'note', 'file')),
  title      text check (title is null or char_length(title) <= 120),
  url        text check (url is null or char_length(url) <= 2000),
  body       text check (body is null or char_length(body) <= 4000),
  -- 'file' kind: a private Storage object (see the storage section below)
  file_path  text,
  file_name  text,
  file_size  bigint,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracker_resources_shape check (
    (kind = 'link' and url is not null) or
    (kind = 'note' and body is not null) or
    (kind = 'file' and file_path is not null)
  )
);
create index if not exists tracker_resources_tracker_idx on tracker_resources (tracker_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — each user only sees their own rows.
-- ---------------------------------------------------------------------------
alter table sections enable row level security;
drop policy if exists sections_own on sections;
create policy sections_own on sections
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table trackers enable row level security;
alter table entries  enable row level security;

drop policy if exists trackers_own on trackers;
create policy trackers_own on trackers
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists entries_own on entries;
create policy entries_own on entries
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table day_notes enable row level security;
drop policy if exists day_notes_own on day_notes;
create policy day_notes_own on day_notes
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table tracker_resources enable row level security;
drop policy if exists tracker_resources_own on tracker_resources;
create policy tracker_resources_own on tracker_resources
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table tracker_steps enable row level security;
drop policy if exists tracker_steps_own on tracker_steps;
create policy tracker_steps_own on tracker_steps
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage — private bucket for resource file uploads (docs + images, 10 MB).
-- Path convention: <auth.uid()>/<tracker_id>/<uuid>-<name>; access via signed
-- URLs. Users may only touch objects under their own <uid>/ folder.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resource-files', 'resource-files', false, 10485760,
  array[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "resource_files_own_select" on storage.objects;
create policy "resource_files_own_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'resource-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "resource_files_own_insert" on storage.objects;
create policy "resource_files_own_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resource-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "resource_files_own_delete" on storage.objects;
create policy "resource_files_own_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resource-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- lists / list_items: free-form collections (Movies watched, Restaurants,
-- Favorite celebrities…) — rows with user-defined columns, kept separate from
-- the habit trackers. See 12-lists.sql.
-- ---------------------------------------------------------------------------
create table if not exists lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade default auth.uid(),
  name       text not null check (char_length(name) between 1 and 120),
  emoji      text not null default '📋',
  columns    jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists lists_user_idx on lists (user_id);

create table if not exists list_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade default auth.uid(),
  list_id    uuid not null references lists(id) on delete cascade,
  values     jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists list_items_list_idx on list_items (list_id);
create index if not exists list_items_user_idx on list_items (user_id);

alter table lists enable row level security;
drop policy if exists lists_own on lists;
create policy lists_own on lists
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table list_items enable row level security;
drop policy if exists list_items_own on list_items;
create policy list_items_own on list_items
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
