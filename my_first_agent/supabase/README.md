# Supabase setup and discovery resources

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
The memory harness is test-only and never an application fallback. G2 does not
calculate fit scores, generate preparation documents, run scheduled searches,
or send email. The two-real-account isolation check remains a release gate.
