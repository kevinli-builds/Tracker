-- 04-streak-side.sql — let a tracker choose which side its streak counts.
-- 'did'     : consecutive days you logged it (total > 0)
-- 'skipped' : consecutive clean days (total = 0)
-- Run once on the existing project (after 03-notes.sql).

alter table trackers
  add column if not exists streak_side text not null default 'did'
    check (streak_side in ('did', 'skipped'));

-- Preserve existing behavior: 'less' goals streaked on clean days before this.
update trackers set streak_side = 'skipped' where goal_direction = 'less';
