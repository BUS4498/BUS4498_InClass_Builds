-- Stage 14: read posts from a chat channel (GroupMe).
-- A scheduled job wakes the channel reader (the read-channel Edge Function) every minute. The reader asks
-- GroupMe for the messages after the last one it handled and sends each one to the AI agent.
--
-- Before you apply this file, replace the two placeholders below with your Project URL and your
-- publishable key (the builder fills them in for you).

-- Where each post came from, and the chat message's ID, so the same message is never saved twice.
alter table public.events add column if not exists source text not null default 'website';
alter table public.events add column if not exists source_id text not null default '';
alter table public.events add column if not exists source_name text not null default '';

create unique index if not exists events_one_per_message
  on public.events (source, source_id)
  where source_id <> '';

-- The reader's bookmark: the last message it handled, per channel.
create table if not exists public.channel_cursor (
  source text primary key,
  last_id text not null default '',
  read_count integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.channel_cursor enable row level security;
revoke all on public.channel_cursor from anon, authenticated;
grant select, insert, update, delete on public.channel_cursor to service_role;

-- The scheduled job. pg_net lets the database call the function over the web.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Scheduling the same job name again replaces the old schedule.
select cron.schedule(
  'read-chat-channel',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://vwbkkkxxndbzzwlizvkn.supabase.co/functions/v1/read-channel',
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_4BdZlY3k9dG_lf97h3wt7A_Cpfmehr9'),
      body := '{}'::jsonb,
      timeout_milliseconds := 25000
    ) as request_id
  $$
);
