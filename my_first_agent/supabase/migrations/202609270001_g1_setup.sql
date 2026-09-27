-- G1 only. Apply only to the approved Supabase project after checking that
-- career_prep schema and career-prep-private bucket do not already exist.
-- This migration deliberately fails on a name collision.

create schema career_prep;
revoke all on schema career_prep from public, anon, authenticated;

create table career_prep.owners (
  id uuid primary key default gen_random_uuid(),
  identity_email text not null unique,
  created_at timestamptz not null default now(),
  constraint identity_email_normalized check (identity_email = lower(btrim(identity_email)) and position('@' in identity_email) > 1)
);

create table career_prep.gateway_nonces (
  nonce text primary key,
  request_id uuid not null,
  expires_at timestamptz not null,
  used_at timestamptz not null default now()
);
create index gateway_nonces_expiry_idx on career_prep.gateway_nonces (expires_at);

create table career_prep.resume_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references career_prep.owners(id),
  version_number integer not null check (version_number > 0),
  original_path text not null unique,
  original_name text not null,
  media_type text not null check (media_type in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain')),
  byte_count integer not null check (byte_count between 1 and 5242880),
  sha256_hex text not null check (sha256_hex ~ '^[0-9a-f]{64}$'),
  extracted_text text not null,
  extracted_passages jsonb not null,
  extraction_status text not null check (extraction_status in ('readable','unreadable')),
  confirmation_status text not null default 'pending' check (confirmation_status in ('pending','confirmed')),
  confirmed_passage_ids jsonb,
  student_correction text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (owner_id, version_number)
);
create index resume_versions_owner_idx on career_prep.resume_versions (owner_id, version_number desc);

create table career_prep.student_scopes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references career_prep.owners(id),
  resume_id uuid not null references career_prep.resume_versions(id),
  version_number integer not null check (version_number > 0),
  start_date date not null,
  end_date date not null,
  role_types text[] not null,
  role_interests text[] not null,
  location_preference text,
  hard_constraints jsonb not null default '[]'::jsonb,
  optional_facts jsonb not null default '{}'::jsonb,
  student_confirmed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (owner_id, version_number),
  constraint valid_timeframe check (start_date <= end_date),
  constraint valid_role_types check (role_types <@ array['internship','entry-level']::text[] and cardinality(role_types) between 1 and 2),
  constraint role_interests_present check (cardinality(role_interests) > 0)
);
create index student_scopes_owner_idx on career_prep.student_scopes (owner_id, version_number desc);

create table career_prep.context_handoffs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references career_prep.owners(id),
  run_id uuid,
  affected_input text not null,
  question text not null,
  source_reference text,
  status text not null default 'awaiting_student' check (status in ('awaiting_student','response_received','still_unresolved')),
  response_text text,
  response_kind text check (response_kind in ('confirmed','corrected','unavailable')),
  assigned_at timestamptz not null default now(),
  response_due_at timestamptz,
  responded_at timestamptz
);
create index context_handoffs_owner_idx on career_prep.context_handoffs (owner_id, assigned_at desc);

-- G1 reads this owner-scoped ledger to distinguish a valid first-run empty
-- state from a failed read. G2 adds evidence and disposition columns.
create table career_prep.opportunity_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references career_prep.owners(id),
  created_at timestamptz not null default now()
);
create index opportunity_ledger_owner_idx on career_prep.opportunity_ledger (owner_id, created_at desc);

alter table career_prep.owners enable row level security;
alter table career_prep.gateway_nonces enable row level security;
alter table career_prep.resume_versions enable row level security;
alter table career_prep.student_scopes enable row level security;
alter table career_prep.context_handoffs enable row level security;
alter table career_prep.opportunity_ledger enable row level security;

revoke all on all tables in schema career_prep from public, anon, authenticated;
revoke all on all sequences in schema career_prep from public, anon, authenticated;
grant usage on schema career_prep to service_role;
grant all on all tables in schema career_prep to service_role;
grant all on all sequences in schema career_prep to service_role;

do $$
begin
  if exists (select 1 from storage.buckets where id = 'career-prep-private') then
    raise exception 'career-prep-private bucket already exists; stop and inspect ownership';
  end if;
end $$;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('career-prep-private', 'career-prep-private', false, 5242880,
        array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']);

-- No browser-facing Storage policies are created. The signed Edge route alone
-- uses the server-side service role and enforces owner-specific paths.
