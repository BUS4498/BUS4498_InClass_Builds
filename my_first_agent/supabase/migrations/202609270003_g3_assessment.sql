-- G3 local migration; apply only to the approved career_prep application schema.
begin;
alter table career_prep.candidate_handoffs
  add column if not exists case_data jsonb,
  add column if not exists version_number integer not null default 1;
alter table career_prep.candidate_handoffs drop constraint candidate_handoffs_owner_id_run_id_candidate_id_key;
create unique index candidate_handoff_case_unique on career_prep.candidate_handoffs(owner_id,run_id,candidate_id,coalesce(case_data->>'case_key','validation'));
alter table career_prep.candidate_handoffs add constraint candidate_handoff_owner_pair unique(id,owner_id);
create table career_prep.candidate_response_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references career_prep.owners(id),
  question_id uuid not null,
  request_id uuid not null,
  question_version integer not null check (question_version > 0),
  response_kind text not null check (response_kind in ('answer','unavailable')),
  response_text text not null check (length(response_text) between 1 and 3000),
  responded_at timestamptz not null default now(),
  unique (owner_id,request_id),
  foreign key (question_id,owner_id) references career_prep.candidate_handoffs(id,owner_id)
);
alter table career_prep.candidate_response_history enable row level security;
revoke all on career_prep.candidate_response_history from public,anon,authenticated;
comment on table career_prep.candidate_response_history is 'Append-only student answers. No answer automatically updates evidence, scores, decisions, or application status.';
commit;
