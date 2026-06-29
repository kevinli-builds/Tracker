-- 06-measure.sql — add a 'measure' tracker type: free-form numeric readings
-- (e.g. weight) where each day holds a single value (latest replaces), vs
-- 'count' which sums taps. Also makes entry values decimal-capable.
-- Run once on the existing project (after 05-resources.sql).

-- 1) Decimal values (e.g. weight 175.4). numeric is exact; existing integer
--    count/yes-no rows are unaffected (ints are valid numerics).
alter table entries alter column value type numeric using value::numeric;

-- 2) Allow the new tracker type. Postgres can't edit a CHECK in place. Find the
--    existing check on `type` by its definition (its auto-generated name may
--    vary) and drop it, then add the 3-type check. Done in a DO block so we
--    don't risk leaving the old 2-type check in force (which would silently
--    reject every 'measure' insert).
do $$
declare cons text;
begin
  select conname into cons
  from pg_constraint
  where conrelid = 'trackers'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%type%in%';
  if cons is not null then
    execute format('alter table trackers drop constraint %I', cons);
  end if;
end $$;

alter table trackers add constraint trackers_type_check
  check (type in ('yesno', 'count', 'measure'));
