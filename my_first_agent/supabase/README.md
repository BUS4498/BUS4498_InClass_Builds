# Supabase setup, discovery, and assessment resources

The G1 migration creates the dedicated `career_prep` schema and six tables
with row level security enabled, plus one private
`career-prep-private` Storage bucket. Check names before applying; the
migration deliberately fails if the schema or bucket already exists. Apply
only to the approved Supabase project `sbwbnhhpdeylkyyqwayp`.

The function source is `functions/career-g1/index.ts`. It imports the
testable domain functions from `functions/_shared/g1-domain.mjs`. The
Supabase browser editor accepts a single-file variant generated with:

`node build-g1-dashboard.mjs <private-output-path>`

The generated file contains source code only and no credentials. Keep
`verify_jwt = false` only when the HMAC gateway secret is configured in both
Supabase and the owner-private Site and the signed request path has passed
connection tests. No public Storage policy is created; original files remain
under an owner-specific private path.

The custom secret name is `CAREER_G1_GATEWAY_SECRET`. Supabase supplies
`SUPABASE_DB_URL`, `SUPABASE_URL`, and
`SUPABASE_SERVICE_ROLE_KEY` to the Edge runtime. The Site uses
`G1_GATEWAY_SECRET` and `SUPABASE_G1_URL` in its server settings.

## G2 addition

Apply the G2 discovery migration only after the G1 baseline. It adds private
run, export, and candidate-question tables, extends the ledger, and allows
XLSX objects in the existing private bucket. Name collisions stop migration;
do not drop existing resources to resolve them. Row level security stays
enabled and browser roles receive no table access.

The same `career-g1` function now dispatches G1 and G2 operations. Rebuild the
single-file source after module changes; its generated registry comes from
`docs/references/job-search-sources.txt`. Publish the UTF-8 source with the same
HMAC authentication configuration. Configure `OPENAI_API_KEY` only in encrypted
Supabase secrets for live discovery. No key is needed for the synthetic run.

The controller reserves external actions in persisted state before calling
them. Compare-and-swap revisions, one active run per owner, request IDs, and
transactional ledger writes prevent overlapping/replayed operations. Unknown
external outcomes are stopped for inspection, never retried automatically.
An XLSX export is private and immutable; checksum, manifest, and metadata
read-back must pass before it becomes downloadable. Owner identity is verified
by the gateway, not accepted from request JSON.

Run all tests from `../app` with `npm test`; build with `npm run build`.
The memory harness is test-only and never an application fallback. Scheduled
searches and email remain later work. The two-real-account isolation check
remains a release gate.

## G3 assessment addition

`202609270003_g3_assessment.sql` follows the G2 migration. After approved
name checks, it adds question case/version fields, replaces the one-question
per candidate unique key with a case-specific key, and adds private append-only
response history. Existing rows are preserved. The composite owner/question
foreign key, RLS, and revoked browser-role privileges enforce ownership.
Do not deploy the new function before this migration is applied and verified.

T4 and T5 are pinned in `g3-runtime.mjs` to `gpt-5.6-luna` with reasoning `none`.
They reuse `OPENAI_API_KEY`. There is no `CAREER_T5_MODEL` setup requirement.

T5 receives an explicit catalog of the checked assessment's criterion, constraint,
and question IDs. Its response schema permits only those citation IDs and requires
at least one. The backend validates against the same catalog and still rejects
invented references. A failed T5 response retains the completed T4 assessment and
does not create a recommendation or trigger a retry.
All model output is checked before it affects a saved assessment or advice.
Scores, ranking, explicit numeric/date comparisons, permissions, and budgets
are controlled in code. The source registry and original discovery caps stay
unchanged. `workHours` is retained from supported JobPosting structured data
when explicitly present, including in material-change detection.

An evidence-only retrieval for Compare Requirements or Examine Evidence Gaps
leaves that subtask pending. Its next model response must supply the findings
before another subtask can start. Retrieval and completion consume the same
six-request budget and original deadline; completion is not a retry. The output
schema exposes only currently permitted subtask names. Compare must classify
all explicit posting requirements before it is recorded as complete. Form is
unavailable until comparison, constraints, and any required student-fit question
are present. Rejected steps never count as completed subtasks.

Repeated gap wording is identified by exact unknown-criterion evidence or one
unambiguous structured field. Broad narrative citations do not merge unrelated
issues. A genuine third material gap remains blocked; rejected additions do
not replace the accepted gap ledger.

The current local controller pins confirmed student inputs, reads prior
owner-scoped opportunity versions/questions for changed postings, and records
model/tool reservations before inference. No new live inference, migration,
or deployment is authorized merely by running unit tests or building a bundle.
Follow the group's concrete deployment and bounded inference-test approval.

### Setup review migration

Apply `202609270004_setup_review.sql` after checking the three added column names. It adds owner workspace revision/reset markers and a versioned scope resume review; it removes no records and changes no access policies. The authenticated reset operation locks the owner, rejects stale revisions and active runs, and verifies its write. The same owner lock serializes search start and setup confirmation. Confirmed summary text becomes explicitly labeled student evidence; raw unconfirmed passages remain stored but are not silently used as confirmed qualifications.

### Opportunity visibility and G4 material review

After name checks, migration `202609270005_opportunity_archive.sql` adds the
owner visibility revision, archive/restore preferences, and action history.
Migration `202609270006_material_review.sql` adds private draft, immutable
version, and exact-version review tables. Both preserve earlier records, enable
RLS, revoke browser-role access, and grant only the existing server role.

Migration `202609270007_material_json.sql` adds JSON card files to the existing
private bucket's allowed MIME types. It checks private visibility, preserves the
existing formats and size limit, and changes no access policy or stored object.

G4 modules reuse the signed gateway and `OPENAI_API_KEY`. No new secret or
provider is required. The controller accepts one explicit saved target and
artifact request, performs zero discovery, revalidates the source, incorporates
relevant saved answers, and retains earlier assessments and exports unchanged.
T6 is a fixed single request using `gpt-5.6-luna`, reasoning `none`, no tools,
5,000 output tokens, 25-second transport, 90-second total, and zero retries.

The approved DOCX template packages are embedded as non-secret assets in
`g4-templates.mjs`; only document.xml is changed when rendering a draft. Files
are saved under the existing owner's private materials path and checksum-read
back before their version record is offered for download. Review/revision
operations use owner locks, exact versions, unique request IDs, and five-second
verification limits. New versions do not inherit prior approval.

Rebuild the single-file Edge bundle after any module change. Apply and verify
required migrations before deploying it, retain HMAC/nonce authentication and
owner-private sharing, and test the browser-to-Storage journey with fictional
inputs before representative live inference or student sharing.
