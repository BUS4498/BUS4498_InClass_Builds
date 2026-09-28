-- Reversible user-managed cleanup. Historical evidence and exports are retained.
begin;
alter table career_prep.owners add column opportunity_revision integer not null default 0 check(opportunity_revision>=0);
create table career_prep.opportunity_visibility (
 owner_id uuid not null references career_prep.owners(id),
 data_mode text not null check(data_mode in ('live','synthetic')),
 opportunity_id text not null,
 archived boolean not null,
 updated_at timestamptz not null default now(),
 primary key(owner_id,data_mode,opportunity_id)
);
create table career_prep.opportunity_cleanup_history (
 owner_id uuid not null references career_prep.owners(id), request_id uuid not null,
 action text not null check(action in ('archive','restore')), selections jsonb not null,
 revision integer not null, created_at timestamptz not null default now(),
 primary key(owner_id,request_id)
);
alter table career_prep.opportunity_visibility enable row level security;
alter table career_prep.opportunity_cleanup_history enable row level security;
revoke all on career_prep.opportunity_visibility,career_prep.opportunity_cleanup_history from public,anon,authenticated;
grant all on career_prep.opportunity_visibility,career_prep.opportunity_cleanup_history to service_role;
commit;
