-- Stage 7: photo uploads
-- Adds the flyer link to each post and the storage bucket for flyer photos.

alter table public.events
  add column flyer_url text not null default '';

-- Visitors may read the flyer link, like the other public columns.
grant select (flyer_url) on public.events to anon, authenticated;

-- Public storage bucket for flyers: anyone can open a photo by its link,
-- but there are no storage policies for the website, so only the agent
-- (using the secret key) can upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('flyers', 'flyers', true, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
