begin;
create table career_prep.material_drafts (
 id uuid primary key, owner_id uuid not null references career_prep.owners(id),
 run_id uuid not null references career_prep.discovery_runs(id), opportunity_id text not null,
 artifact_type text not null check(artifact_type in ('resume_tailoring','cover_letter','interview_cards')),
 data_mode text not null check(data_mode in ('live','synthetic')), bundle jsonb not null,
 status text not null, handoff text, latest_version integer not null default 0,
 review_due_at timestamptz not null, created_at timestamptz not null default now(), unique(owner_id,run_id)
);
create table career_prep.material_versions (
 id uuid primary key, owner_id uuid not null references career_prep.owners(id),
 draft_id uuid not null references career_prep.material_drafts(id), version_number integer not null,
 request_id uuid not null, content jsonb not null, storage_path text not null,
 sha256_hex text not null, byte_count integer not null, origin text not null,
 created_at timestamptz not null default now(), unique(owner_id,draft_id,version_number), unique(owner_id,request_id)
);
create table career_prep.material_reviews (
 id uuid primary key, owner_id uuid not null references career_prep.owners(id),
 draft_id uuid not null references career_prep.material_drafts(id), version_id uuid not null references career_prep.material_versions(id),
 request_id uuid not null, decision text not null check(decision in ('approve','request_changes','decline')),
 intended_use text not null, comments text not null, attestation jsonb not null,
 created_at timestamptz not null default now(), unique(owner_id,request_id), unique(owner_id,version_id)
);
alter table career_prep.material_drafts enable row level security;
alter table career_prep.material_versions enable row level security;
alter table career_prep.material_reviews enable row level security;
revoke all on career_prep.material_drafts,career_prep.material_versions,career_prep.material_reviews from public,anon,authenticated;
grant all on career_prep.material_drafts,career_prep.material_versions,career_prep.material_reviews to service_role;
commit;
