-- G2 additive migration for the approved career_prep schema only.
begin;
create table career_prep.discovery_runs (
  id uuid primary key,
  owner_id uuid not null references career_prep.owners(id),
  client_request_id uuid not null,
  data_mode text not null check (data_mode in ('live','synthetic')),
  scope_id uuid not null references career_prep.student_scopes(id),
  resume_id uuid not null references career_prep.resume_versions(id),
  status text not null default 'running' check(status in ('running','complete','awaiting_student','operationally_incomplete')),
  revision integer not null default 0,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id,client_request_id)
);
create unique index discovery_one_active_owner on career_prep.discovery_runs(owner_id) where status='running';
create index discovery_owner_recent on career_prep.discovery_runs(owner_id,created_at desc);
alter table career_prep.opportunity_ledger
  add column run_id uuid references career_prep.discovery_runs(id),
  add column data_mode text check(data_mode in ('live','synthetic')),
  add column candidate_id text,
  add column opportunity_id text,
  add column version_number integer,
  add column record jsonb;
create unique index ledger_run_candidate on career_prep.opportunity_ledger(owner_id,run_id,candidate_id);
create index ledger_identity_version on career_prep.opportunity_ledger(owner_id,data_mode,opportunity_id,version_number desc);
create table career_prep.discovery_exports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references career_prep.owners(id),
  run_id uuid not null references career_prep.discovery_runs(id),
  version_number integer not null,
  storage_path text not null unique,
  sha256_hex text not null,
  row_ids jsonb not null,
  byte_count integer not null,
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(owner_id,run_id), unique(owner_id,version_number)
);
create table career_prep.candidate_handoffs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references career_prep.owners(id),
  run_id uuid not null references career_prep.discovery_runs(id), candidate_id text not null,
  question text not null, source_reference text not null,
  status text not null default 'awaiting_student' check(status in ('awaiting_student','response_received','still_unresolved')),
  answer text, response_kind text check(response_kind in ('answer','unavailable')),
  response_due_at timestamptz not null default (now()+interval '1 day'), responded_at timestamptz,
  created_at timestamptz not null default now(), unique(owner_id,run_id,candidate_id)
);
alter table career_prep.discovery_runs enable row level security;
alter table career_prep.discovery_exports enable row level security;
alter table career_prep.candidate_handoffs enable row level security;
revoke all on career_prep.discovery_runs,career_prep.discovery_exports,career_prep.candidate_handoffs from public,anon,authenticated;
grant all on career_prep.discovery_runs,career_prep.discovery_exports,career_prep.candidate_handoffs to service_role;
update storage.buckets set allowed_mime_types=array_append(allowed_mime_types,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  where id='career-prep-private' and not ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'=any(allowed_mime_types));
commit;
