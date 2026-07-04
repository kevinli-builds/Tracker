-- 11-goals.sql — an optional numeric goal target + period on a tracker.
-- Lets a tracker carry a target for the current period: e.g. "≥ 3 runs/week"
-- (goal_direction 'more') or "≤ 2 drinks/week" (goal_direction 'less'). Both
-- columns nullable ⇒ no target. goal_period is 'day' or 'week'. Only meaningful
-- for count / yes-no trackers (measure is latest-replace, series forces its own
-- goal), so the app only surfaces it for those types.
-- Run once on the existing project (after 10-storage.sql).

alter table trackers
  add column if not exists goal_target numeric
    check (goal_target is null or goal_target > 0),
  add column if not exists goal_period text
    check (goal_period is null or goal_period in ('day', 'week'));
