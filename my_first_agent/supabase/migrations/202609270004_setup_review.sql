-- User-requested editable resume summary and reset. No records are deleted.
begin;
alter table career_prep.owners
  add column setup_revision integer not null default 0 check (setup_revision >= 0),
  add column setup_reset_at timestamptz;
alter table career_prep.student_scopes add column resume_review jsonb;
comment on column career_prep.student_scopes.resume_review is 'Versioned student-confirmed summary; edits do not confirm all original passages.';
comment on column career_prep.owners.setup_reset_at is 'A reset requires a new confirmed setup; historical resumes, runs and exports remain intact.';
commit;
