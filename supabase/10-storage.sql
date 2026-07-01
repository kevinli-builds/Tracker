-- 10-storage.sql — file uploads for tracker resources. Adds a 'file' resource
-- kind + a private Storage bucket (per-user folders, signed-URL access).
-- Run once on the existing project (after 09-subtitle.sql).

-- 1) tracker_resources gains a 'file' kind + file metadata.
alter table tracker_resources add column if not exists file_path text;
alter table tracker_resources add column if not exists file_name text;
alter table tracker_resources add column if not exists file_size bigint;

alter table tracker_resources drop constraint if exists tracker_resources_kind_check;
alter table tracker_resources add constraint tracker_resources_kind_check
  check (kind in ('link', 'note', 'file'));

alter table tracker_resources drop constraint if exists tracker_resources_shape;
alter table tracker_resources add constraint tracker_resources_shape check (
  (kind = 'link' and url is not null) or
  (kind = 'note' and body is not null) or
  (kind = 'file' and file_path is not null)
);

-- 2) Private bucket for the files (10 MB cap; docs + images only).
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

-- 3) RLS on storage.objects: a user may only touch files under their own
--    <uid>/... folder. Path convention: <auth.uid()>/<tracker_id>/<uuid>-<name>.
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
