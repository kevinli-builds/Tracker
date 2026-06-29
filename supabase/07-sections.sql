-- 07-sections.sql — optional collapsible groups ("sections") for the dashboard.
-- A tracker's section_id points to a section; null = ungrouped (shown first).
-- Run once on the existing project (after 06-measure.sql).

create table if not exists sections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade default auth.uid(),
  title      text not null check (char_length(title) between 1 and 80),
  sort_order int not null default 0,
  collapsed  boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists sections_user_idx on sections (user_id);

-- Deleting a section just un-groups its trackers (on delete set null).
alter table trackers
  add column if not exists section_id uuid references sections(id) on delete set null;
create index if not exists trackers_section_idx on trackers (section_id);

alter table sections enable row level security;
drop policy if exists sections_own on sections;
create policy sections_own on sections
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
