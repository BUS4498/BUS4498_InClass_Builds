# Career Opportunity Prep Agent Site — G1

This source implements the owner-private setup and context journey. Search, fit
scoring, preparation, scheduling, and email are later build groups. The
synthetic sample in the interface is local demonstration data and cannot be
saved as a student's resume.

## Build and test

From this folder, run `npm test` and `npm run build`. The build creates
`dist/` for the Sites-managed source repository. The original GitHub
repository keeps source files; `dist/` is ignored here.
The public source uses `.openai/hosting.example.json` for a local build. A
Sites-managed checkout needs its own `.openai/hosting.json` with its assigned
project ID. That file is ignored in the original repository.

## Server connection

The Site Worker requires `SUPABASE_G1_URL` and secret
`G1_GATEWAY_SECRET` in the Sites runtime settings. The first value is the
project's `career-g1` Edge Function URL. The Edge Function requires the same
secret under `CAREER_G1_GATEWAY_SECRET` in Supabase's encrypted function
secrets. Supabase supplies its own database URL and server-side Storage key.
Never put a secret in a browser file, repository, Site archive, or issue.

The Site gets the account identity from its authenticated request header,
signs an operation, body hash, nonce, and 30-second expiry, then calls the Edge
Function. The Edge Function verifies the signature and one-use nonce before
using server-only storage and database access. Both sides fail closed while
unconfigured. The Site remains owner-private during G1 review.

## Current routes

- `GET /api/session` and `GET /api/status`: signed-in and connection state.
- `POST /api/g1/preview`: preserve an original PDF, DOCX, or TXT resume and
  return source-linked extracted passages.
- `POST /api/g1/confirm`: confirm passages and save a versioned student search
  scope with timeframe and role types.
- `POST /api/g1/context`: retrieve owner-scoped context or an explicit
  missing-input/operational status.
- `POST /api/g1/handoff`: record an answer or an unavailable-information
  response to a pending question.

All setup operations are owner-scoped on the server. They do not perform a job
search, model call, email send, or application submission.
