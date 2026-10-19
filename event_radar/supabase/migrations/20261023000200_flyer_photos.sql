-- Stage 7: photo uploads.
-- Each post can carry one flyer photo. The AI agent uploads it; the website only shows it.

-- The public link to the post's flyer photo, or empty if there is none.
alter table public.events
  add column flyer_url text not null default '';

-- The website may read the new column too.
grant select (flyer_url) on table public.events to anon, authenticated;

-- A public storage bucket for flyer photos: 5 MB each, JPG and PNG only.
-- No storage policies for the website: only the agent (secret key) uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('flyers', 'flyers', true, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
