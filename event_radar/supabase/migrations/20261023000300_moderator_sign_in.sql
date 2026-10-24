-- Stage 8: moderator sign-in
-- Signed-in users (moderators) can read every post and approve or reject it.
-- This is safe only because new sign-ups are turned off in Supabase Auth,
-- so the only signed-in users are the moderator accounts made by hand.

create policy "Moderators can read every event"
  on public.events
  for select
  to authenticated
  using (true);

create policy "Moderators can review events"
  on public.events
  for update
  to authenticated
  using (true)
  with check (status in ('published', 'waiting', 'rejected'));

-- Moderators see the whole post (the original announcement, the reasons, the notes).
grant select on public.events to authenticated;

-- ...but may change only the review columns.
grant update (status, status_reason, reviewed_at, reviewed_by) on public.events to authenticated;
