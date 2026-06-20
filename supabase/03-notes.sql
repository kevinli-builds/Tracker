-- 03-notes.sql — per-day notes for a tracker (one note per tracker per day).
-- Run once on the existing project (after 02-auth.sql).

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

alter table day_notes enable row level security;
drop policy if exists day_notes_own on day_notes;
create policy day_notes_own on day_notes
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
