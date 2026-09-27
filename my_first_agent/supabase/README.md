# Supabase G1 resources

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
