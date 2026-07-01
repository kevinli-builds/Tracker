-- 09-subtitle.sql — an optional one-line subtitle/description on a tracker,
-- shown under its name (e.g. a short description of a stretch).
-- Run once on the existing project (after 08-series.sql).

alter table trackers
  add column if not exists subtitle text check (subtitle is null or char_length(subtitle) <= 200);
