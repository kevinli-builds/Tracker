-- Migration 13: public share page ("frontpage").
-- Run after 12-lists.sql. Adds:
--   * trackers.shared — per-tracker opt-in to the owner's public page
--   * shares — one row per user: page on/off, unguessable token, display name
--   * public_share(token) — the ONLY anonymous read path: a security-definer
--     RPC that returns pre-aggregated day totals for shared, non-archived
--     trackers. Notes, resources, step labels, and raw entries stay private;
--     no table gains an anon RLS policy.

-- Per-tracker opt-in. Default off: nothing is public until chosen.
alter table trackers add column if not exists shared boolean not null default false;

-- One share per user. Deleting the row revokes the page; updating token
-- rotates the link. The token is generated client-side (32 hex chars) and is
-- the whole secret — treat the URL like a password.
create table if not exists shares (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users(id) on delete cascade default auth.uid(),
  token        text not null unique check (char_length(token) between 20 and 64),
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at   timestamptz not null default now()
);

alter table shares enable row level security;
drop policy if exists shares_own on shares;
create policy shares_own on shares
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The public read path. SECURITY DEFINER so it can read across RLS, keyed by
-- the unguessable token: anyone without it gets null, and there is no way to
-- list tokens (shares has no anon policy). Returns only what the page needs —
-- tracker display fields + per-day totals — never notes/resources/step labels.
-- first_day lets the client compute `since` with its local-day convention.
create or replace function public.public_share(share_token text)
returns jsonb
language sql
stable
strict
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'display_name', s.display_name,
    'trackers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'name', t.name,
          'subtitle', t.subtitle,
          'type', t.type,
          'color', t.color,
          'emoji', t.emoji,
          'unit', t.unit,
          'goal_direction', t.goal_direction,
          'streak_side', t.streak_side,
          'goal_target', t.goal_target,
          'goal_period', t.goal_period,
          'created_at', t.created_at,
          'first_day', (select min(e.day) from public.entries e where e.tracker_id = t.id),
          'step_count', (select count(*) from public.tracker_steps st where st.tracker_id = t.id),
          'totals', coalesce((
            select jsonb_object_agg(d.day, d.total)
            from (
              select e.day, sum(e.value) as total
              from public.entries e
              where e.tracker_id = t.id
              group by e.day
            ) d
          ), '{}'::jsonb)
        )
        order by t.sort_order, t.created_at
      )
      from public.trackers t
      where t.user_id = s.user_id and t.shared and not t.archived
    ), '[]'::jsonb)
  )
  from public.shares s
  where s.token = share_token
$$;

revoke all on function public.public_share(text) from public;
grant execute on function public.public_share(text) to anon, authenticated;
