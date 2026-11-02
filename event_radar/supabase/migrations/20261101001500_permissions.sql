-- Week 11: permissions and boundaries (runtime/permissions-plan.md).
-- Every switch or number a moderator may change lives here, one row each. The agent reads this table at the
-- start of every post, so a change needs no redeploy. Only signed-in moderators can change a row, a change
-- needs a reason, and the database stamps who changed it and when. The agent can read the table, never write it.

create table if not exists public.agent_permissions (
  key text primary key,
  label text not null,
  kind text not null check (kind in ('switch', 'number')),
  value text not null,
  reason text not null check (char_length(btrim(reason)) between 3 and 300),
  changed_by text not null default '',
  updated_at timestamptz not null default now(),
  sort int not null default 0,
  -- A switch is on or off; a number is a whole number. Anything else is refused by the database.
  constraint agent_permissions_value_fits_kind check (
    (kind = 'switch' and value in ('on', 'off')) or (kind = 'number' and value ~ '^[0-9]{1,5}$')
  )
);

-- A change needs a new reason, and the database records who made it and when (the website can't fake either).
create or replace function public.agent_permissions_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.value is distinct from old.value and btrim(new.reason) = btrim(old.reason) then
    raise exception 'Type a new reason for changing "%".', old.label using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  new.changed_by := coalesce(nullif(auth.jwt() ->> 'email', ''), nullif(btrim(new.changed_by), ''), session_user);
  return new;
end $$;

drop trigger if exists agent_permissions_stamp on public.agent_permissions;
create trigger agent_permissions_stamp before update on public.agent_permissions
  for each row execute function public.agent_permissions_stamp();

alter table public.agent_permissions enable row level security;

drop policy if exists "Moderators can read the permissions" on public.agent_permissions;
create policy "Moderators can read the permissions"
  on public.agent_permissions for select
  to authenticated
  using (true);

drop policy if exists "Moderators can change the permissions" on public.agent_permissions;
create policy "Moderators can change the permissions"
  on public.agent_permissions for update
  to authenticated
  using (true)
  with check (true);

-- Visitors get nothing. Moderators read every row and change only the value, the reason, and the stamp.
-- The agent (service_role) may read, never write: it can't change a switch (plan, Never 3).
-- No one gets insert or delete from the website or the agent, so a switch can't be removed.
revoke all on public.agent_permissions from anon, authenticated, service_role;
grant select on public.agent_permissions to authenticated;
grant update (value, reason, changed_by, updated_at) on public.agent_permissions to authenticated;
grant select on public.agent_permissions to service_role;

-- The plan's "May, with a limit" switches and numbers, plus the off switch. Fixed limits (the AI models,
-- the post length) are constants in the agent's code: only the builders change those.
insert into public.agent_permissions (key, label, kind, value, reason, changed_by, sort) values
  ('paused', 'Paused (the off switch)', 'switch', 'off', 'The agent runs; any moderator can pause it here.', 'Nicole (permissions plan)', 1),
  ('publish_on_own', 'Publish on its own', 'switch', 'on', 'From the permissions plan: on. Off, every post waits for a moderator.', 'Nicole (permissions plan)', 2),
  ('posts_per_day', 'Posts per day', 'number', '100', 'From the permissions plan: 100 in any 24 hours, then it refuses until tomorrow.', 'Nicole (permissions plan)', 3),
  ('days_ahead', 'Days ahead', 'number', '60', 'From the permissions plan: further out, the post waits (rule R8).', 'Nicole (permissions plan)', 4),
  ('new_club_wait_days', 'New-club wait (days)', 'number', '30', 'From the permissions plan: a club added from now on waits this many days.', 'Nicole (permissions plan)', 5)
on conflict (key) do nothing;

-- New-club wait: the clubs already on the list count as established. A club added from now on is not,
-- so its posts wait for a moderator until the wait has passed since it joined the list (created_at).
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'clubs' and column_name = 'established') then
    alter table public.clubs add column established boolean not null default false;
    update public.clubs set established = true where not established;
  end if;
end $$;

-- The agent can't write a rule (plan, Never 3): it reads the lessons and the club list, and only moderators
-- change them (the website for lessons, the Table Editor for clubs).
revoke insert, update, delete, truncate on public.lessons from service_role;
revoke insert, update, delete, truncate on public.clubs from service_role;
grant select on public.lessons, public.clubs to service_role;

-- The agent can't delete a post (plan, Never 4). A moderator's "Clear the board" still works: it is a
-- signed-in person (authenticated), not the agent. Truncate (emptying the whole table) goes too.
revoke delete, truncate on public.events from service_role;
