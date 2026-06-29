-- 06-measure.sql — add a 'measure' tracker type: free-form numeric readings
-- (e.g. weight) where each day holds a single value (latest replaces), vs
-- 'count' which sums taps. Also makes entry values decimal-capable.
-- Run once on the existing project (after 05-resources.sql).

-- 1) Decimal values (e.g. weight 175.4). numeric is exact; existing integer
--    count/yes-no rows are unaffected (ints are valid numerics).
alter table entries alter column value type numeric using value::numeric;

-- 2) Allow the new tracker type. Postgres can't edit a CHECK in place, so drop
--    and recreate it. The column-level check on `type` gets Postgres's
--    deterministic default name `trackers_type_check` (<table>_<column>_check),
--    so we can drop it by name.
alter table trackers drop constraint if exists trackers_type_check;
alter table trackers add constraint trackers_type_check
  check (type in ('yesno', 'count', 'measure'));
