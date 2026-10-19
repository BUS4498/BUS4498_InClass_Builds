-- Stage 8: moderator sign-in.
-- A signed-in moderator can see every post and approve or reject the ones that wait.
-- This is safe only because new sign-ups are turned off in Supabase Auth:
-- the only signed-in users are the moderator accounts made in Authentication → Users.

-- Moderators may read every post, whatever its status.
create policy "Moderators can read every post"
  on public.events
  for select
  to authenticated
  using (true);

-- Moderators may change a post, but only to published, waiting, or rejected.
create policy "Moderators can review posts"
  on public.events
  for update
  to authenticated
  using (true)
  with check (status in ('published', 'waiting', 'rejected'));

-- Moderators may read every column, and change only the review columns.
grant select on table public.events to authenticated;
grant update (status, status_reason, reviewed_at, reviewed_by) on table public.events to authenticated;
