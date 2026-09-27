# Career Opportunity Prep Agent Site — G1 and G2

This source implements owner-private setup, bounded discovery, source checking,
and a versioned opportunity log with XLSX downloads. Fit scoring, preparation,
scheduling, and email are later build groups. The
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
unconfigured. The Site remains owner-private during group review. A live
two-account isolation check is required before student sharing or real intake.

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

All setup operations are owner-scoped on the server.

## Discovery and log

The five G2 POST routes are `/api/g2/start`, `/api/g2/step`, `/api/g2/runs`,
`/api/g2/download`, and `/api/g2/answer`. The server uses confirmed resume and
scope versions, never an owner ID supplied by the browser. Keep the browser
open while a manual run progresses. Inspect saved runs after interruption;
an uncertain external action is stopped without an automatic retry.

Live discovery requires `OPENAI_API_KEY` in Supabase function secrets. It uses
`gpt-5.6-luna` with reasoning `none`, sending role and timeframe search intent,
not resume contents. Limits are eight API attempts, eight hosted-call
reservations, forty screened posting leads, twenty-four direct reads,
480 seconds for discovery, fifteen seconds per external call, and zero retries.
Provider query strings are recorded only when returned. Search category and
help pages are logged as ignored references, not job leads.

All eight source categories remain visible, including skipped or restricted
sources. Only exact supported authoritative posting pages can supply verified
facts. Missing evidence remains unknown; verified source access does not
establish eligibility or fit. The synthetic-run control uses fictional fixtures
without external searches or model calls, and synthetic/live log rows stay
separate. Questions preserve answers and explicit unknowns; targeted
revalidation is a later group.

The log records every screened disposition. A private XLSX snapshot is offered
only after ledger and file read-back checks. Select Download, then the verified
Save link. A failed export remains incomplete; prior snapshots stay unchanged.
No current operation sends email, contacts employers, or submits applications.
