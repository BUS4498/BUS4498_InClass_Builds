-- User-requested full workspace reset. This migration deletes no student data.
alter table career_prep.owners
 add column reset_pending boolean not null default false,
 add column reset_request_id uuid,
 add column last_reset_request_id uuid;

create table career_prep.workspace_requests (
 owner_id uuid not null references career_prep.owners(id),
 request_id uuid not null,
 operation text not null,
 expires_at timestamptz not null,
 primary key(owner_id,request_id)
);
alter table career_prep.workspace_requests enable row level security;
revoke all on career_prep.workspace_requests from public,anon,authenticated;
grant all on career_prep.workspace_requests to service_role;

comment on table career_prep.workspace_requests is
 'Private request leases prevent a full reset racing with active uploads, reads, generation, or writes. No resume or posting content is stored here.';
