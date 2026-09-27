# Career Opportunity Prep Agent Site — G1 through G4

This source implements owner-private setup, bounded discovery, source checking,
and a versioned opportunity log with XLSX downloads. G3 adds evidence-backed
fit assessments, ranked summaries, next-step advice, and saved questions.
G4 adds one-posting reassessment, editable DOCX drafts, interview cards, and
version-specific student review. Scheduling and email remain later work. The
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
  return a source-derived editable summary and the original extracted passages.
- `POST /api/g1/confirm`: confirm the final edited summary and save a versioned student search
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
separate. Questions preserve answers and explicit unknowns. Preparation can
request a new assessment of one saved posting using its relevant saved answers.

The log records every screened disposition. A private XLSX snapshot is offered
only after ledger and file read-back checks. Select Download, then the verified
Save link. A failed export remains incomplete; prior snapshots stay unchanged.
No current operation sends email, contacts employers, or submits applications.

## G3 assessment and questions

Both T4 and T5 use `gpt-5.6-luna`, reasoning `none`, through the existing
Supabase `OPENAI_API_KEY`. No additional model provider or secret is needed.
The controller selects work from source-validated new or changed postings.
T4 chooses bounded subtasks; each posting has at most six inference requests,
six read-only evidence/constraint tools, and 120 seconds. T5 makes one fixed
recommendation request within 60 seconds. Model requests have a 25-second
call timeout and no retries. There is no web tool in either assessment task.

Only the student-confirmed summary and other confirmed student facts are included for reviewed setups; legacy setups must confirm a summary before another search. The score uses
fixed weights: required/unclear 2, preferred/interest 1; full/half/zero credit
for matched/partial/documented-gap evidence. Unknowns contribute lower and
upper bounds. A number requires at least one supported student comparison.
Eligibility and preparation readiness remain separate. Exact quote checks
verify provenance; model interpretation still needs live quality evaluation.

Optional setup fields capture directly confirmed weekly hours, work locations,
remote availability, US work authorization, and minimum hourly pay. Blank
values remain unknown. Only explicit, directly comparable posting values
produce a deterministic comparison. Ambiguous phrases, geographic equivalence,
currency conversions, sponsorship, and unstated facts remain unresolved.

The results show up to five stable scored postings and up to three needing a
student fact, with separate source issues and honest shortfalls. Expand each
score for criterion and constraint evidence. Answers and explicit unknowns are
saved with owner/version checks and append-only response history. Saving an
answer does not alter the original score or trigger reassessment. The student
explicitly starts the targeted continuation from Preparation.

The immutable workbook adds Fit Evidence, Questions, and Next Steps to the four
G2 sheets. Constraints carry references alongside qualification evidence.
Failed recommendations retain completed assessments while later work stays
not processed. Synthetic mode uses a separate fictional student and six
fictional postings, makes no external requests, and remains visibly labeled.

G3 is integrated into the private Site and tested with hosted fictional runs.
A representative real-source hosted assessment and two actual student
identities remain release gates. Local tests alone do not establish readiness.

### Pages, resume review, and reset

My setup (`/setup`), Opportunities (`/opportunities`), Preparation (`/preparation`), and Schedule (`/schedule`) are separate page views with direct navigation and browser history. Schedule remains visibly pending its later feature group. Check the facts uses an editable source-derived summary, a single confirmation control, and collapsed source passages. The final summary is stored with the scope version; edits clear confirmation. `POST /api/g1/reset` starts a new setup, preserves historical records and exports, checks the owner workspace revision, and refuses active runs. A new resume upload and confirmed setup are required after reset.

### Archive and restore

The opportunity library supports selected postings or all currently visible
postings, with a confirmation dialog showing the exact set. The Archived view
supports restore. `/api/g2/library` reads visibility and `/api/g2/cleanup`
records an owner-scoped, revision-checked archive/restore action. Prior scores,
answers, drafts, ledger versions, and downloaded snapshots are preserved.

## G4 preparation and student review

Select one saved posting, one artifact, and confirm the request. The controller
uses the current confirmed setup, rereads only the exact saved source, checks
employer/role/job identity, and runs T4/T5 before T6. It performs zero discovery
searches. A changed or unavailable target cannot become a successful draft.
The request does not prepare additional artifact types or other postings.

T6 uses one `gpt-5.6-luna` request, reasoning `none`, no tools, at most 5,000
output tokens, a 25-second transport limit, a 90-second task limit, and no retries.
Factual draft text is restricted to exact supported student excerpts; verified
posting references explain relevance. Personal wording and missing facts remain
visible student-completion prompts. This is an editable evidence-based first
draft, not a polished final application. The student supplies final wording.

Resume and cover-letter downloads use the approved DOCX templates. Repeated
education, work, leadership entries and bullets are preserved; the original
upload is never overwritten. Resume changes and proposed omissions are marked
for review. Source notes follow the draft on separate pages. Interview cards
have accessible front/reveal controls and a structured JSON download.

`/api/g4/start`, `/api/g4/materials`, `/api/g4/revision`, `/api/g4/review`, and
`/api/g4/download` require the authenticated owner. Saved files undergo checksum
readback. Student edits create immutable versions. Approval requires the exact
latest version, resolved placeholders, intended use, and factual attestations.
Request changes or decline requires a reason. A new version needs new review;
old decisions remain visible. Review does not send anything or apply for a job.

Synthetic mode uses separate fictional assessment evidence and makes no model
or search requests. Model quality evidence and remaining release gates are
reported at the group checkpoint; do not infer full readiness from deployment.
