-- 12-lists.sql — free-form "lists" (a.k.a. collections): things you keep rows of
-- rather than log daily, e.g. Movies watched, Restaurants, Favorite celebrities.
-- Each list has user-defined columns (stored as jsonb) and rows (list_items,
-- one jsonb value-map each). Separate from the habit `trackers` tables.
-- Run once on the existing project (after 11-goals.sql).

create table if not exists lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade default auth.uid(),
  name       text not null check (char_length(name) between 1 and 120),
  emoji      text not null default '📋',
  columns    jsonb not null default '[]'::jsonb,  -- [{ id, name, type: text|date|number }]
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists lists_user_idx on lists (user_id);

create table if not exists list_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade default auth.uid(),
  list_id    uuid not null references lists(id) on delete cascade,
  values     jsonb not null default '{}'::jsonb,  -- { columnId: stringValue }
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
