# Record and Present Results Task Specification

> **Worked example:** Automation levels, tool names, data structures, and operating limits in this specification are proposed design defaults. Only changes permitted by the existing workflow may be recorded.

## Basic Information

- **Task ID:** T7
- **Task name:** Record and Present Results
- **Task type:** Remember
- **Task owner:** Career Opportunity Prep Agent; the student owns their private hosted ledger and downloaded spreadsheet snapshots and approves decisions outside routine recording.
- **Automation level (proposed):** L1.

## 1. Task Description

Use fixed rules to assemble every screened lead's disposition, update the signed-in student's private Supabase job opportunity ledger without overwriting prior versions, generate a version-labeled `.xlsx` snapshot for local download, read both saved results back, and present two traceable summary groups to the student. A scheduled run updates hosted records; it cannot silently change a copy already downloaded to the student's device.

For discovery, log all T2-screened leads, including source-verified assessed, needs student information, excluded, inaccessible, uncorroborated secondary, and not processed. Give each stable ID, lead and authoritative links, source coverage, first/last seen times, run and evidence versions, and a reason/status. Record completed assessments, recommendations, and review-only drafts when available. Student-answerable H2 cases are candidate-level pending records; other candidates continue. On early operational stop, mark remaining candidates not processed and preserve available work. A held unvalidated lead never becomes a scored record solely because clarification was requested. For a targeted update, change only the identified target's T3-revalidated posting fields, assessment, recommendation, clarification history, and requested drafts; a pending candidate becomes tracked only after T3 validates it. Preserve prior ledger and spreadsheet-snapshot versions and linked evidence.

Recommendations are stored separately from student decisions. A recommendation to archive, apply, or follow up does not authorize changing an application status, sending a message, or performing the action. Do not replace student profile facts, overwrite final materials, or mark a draft approved without a version-specific student decision. This workflow does not submit applications or contact employers.

Rank the source-verified, scored candidates only after all available T4/T5 results arrive. Use the controller-checked 1–5 score and unrounded weighted fraction for within-band order; do not place a candidate with a material user-answerable rank-changing unknown in the final ranked group. A material unknown employer/posting fact that could change the score or rank goes to the source/technical queue, not the student-question or final ranked group. Break remaining ties by supported posting recency, then stable posting ID. Show up to five top scored summaries, aiming for three to five when enough qualify. Separately show up to three promising source-verified postings needing a specific student answer, ordered by confirmed role/timeframe relevance, supported upper score bound when available, then stable ID; do not assign a final rank or invent a score. Other external/source issues stay in the coverage queue. Report fewer than target honestly; never add weak leads to fill either group.

Write a run record even when no opportunity qualifies, with actual discovery API attempts, reserved/observed hosted-search calls, observed provider queries or unavailable status, lead/direct-posting-read counts, site coverage, and shortfalls. A needs-information group can coexist with a completed discovery run because the affected opportunity remains pending rather than being counted as scored. Missing starting resume/scope leads to awaiting student; required automated or hosted ledger/export verification failure is operationally incomplete. A successful bounded search with individually skipped pages may complete with visible coverage limits; systemic search failure cannot. H1 persists its own owner-scoped context handoff independently if the opportunity ledger is inaccessible while the handoff store remains available. Drafts awaiting H3 review or preparation blocked solely on a recorded human input do not prevent search/record completion; a technical T6 failure does. T8 email status is separate from this search/record outcome.

## 2. Inputs

### Input 1

- **Input name:** Run context and collection snapshot
- **Contents and format:** Run ID, server-verified student owner, manual/scheduled/targeted trigger, confirmed resume and search-scope versions, student request, tracked IDs or one pending-candidate reference, existing owner-scoped ledger/evidence/export versions, and private storage references. Distinguish a valid empty first-run ledger from a missing or unreadable existing ledger; do not store full resume text in rows.
- **Source:** T1: Retrieve Student Context.

### Input 2

- **Input name:** Discovery results
- **Contents and format:** T2's Search run log and T3's source-verified records and Validation results, including eight-source coverage statuses, actual discovery API-attempt, reserved/observed hosted-search-call, lead, direct-posting-read, and skipped-page counts, plus observed provider queries or unavailable status, every screened disposition, source verification, shortfalls, and unresolved issues. Distinguish candidate-level access failure from systemic failure. For a targeted update, mark discovery not applicable with zero discovery attempts/leads and include the single target's revalidation and changes.
- **Source:** T2: Search Career Sources and T3: Validate Opportunities for discovery; T1's not-applicable search log and T3's revalidation results for targeted update.

### Input 3

- **Input name:** Opportunity results
- **Contents and format:** Each validated candidate's available T4 assessment with controller-checked 1–5 score/range or `Insufficient evidence to rate`, unrounded weighted fraction/bounds, criterion ledger and resume/posting references, T5 recommendation when completed, and H2 question when a student-answerable fact could change assessment or rank. Preserve separate fit, eligibility, readiness, and external unknowns. Explicit pending/not-processed entries account for missing outputs without manufacturing them. Include IDs and evidence versions.
- **Source:** T4: Assess Opportunity Fit and T5: Recommend Next Actions.

### Input 4

- **Input name:** Preparation results
- **Contents and format:** T6's Review-only draft and Preparation handoff when preparation was requested and reached; otherwise explicitly record not requested, or requested but not processed because of an earlier stop. Include draft IDs, versions, review status, and unresolved requests.
- **Source:** T6: Prepare Review-Only Materials.

- **If a required input is missing or invalid:** Stop the affected write, identify the missing or inconsistent result, and present the issue. Intentional pending/not-processed records are valid partial inputs but never scored recommendations. Reject another owner's record, out-of-scope changes, conflicting ledger/export versions, excess search/read/result counts, unsupported claims, or an unavailable store whose write cannot be verified. Do not silently omit a screened lead, label a provisional range as a final rank, or treat an absent draft as fulfilled preparation.

## 3. Outputs

### Output 1

- **Output name:** Verified collection update
- **Contents and format:** Versioned owner-scoped Supabase job ledger and a private, downloadable `.xlsx` snapshot with all screened opportunities and their disposition, stable ID, source/authoritative URL, first/last seen, run ID, resume/posting evidence versions, score/range or question/status, recommendation, draft references, and update time, plus separate pending-handoff and evidence records. Include a ledger read-back result identifying intended rows, fields, and versions and an export read-back identifying the snapshot version, row IDs/count, and verified file. Keep full resume text and secrets out of the spreadsheet.
- **Next task or recipient:** The student's hosted job ledger and downloadable spreadsheet; T1 on a later run; T8 for a scheduled digest only after verified ledger and export read-back.
- **Complete when:** All intended permitted ledger writes and the matching `.xlsx` snapshot are confirmed by read-back, no unrelated or other-student records changed, and the same run and opportunity identifiers cannot create duplicate entries. A partially created export is not presented as current.

### Output 2

- **Output name:** Student run summary
- **Contents and format:** Human-readable two-group summary: up to three to five ranked scored postings and up to two to three source-verified postings needing a specific student answer, with honest shortfalls. For each show employer/agency, role, selected timeframe fit, location/work mode, pay/posting date/deadline when stated, checked authoritative link and time, 1–5 score or provisional range/insufficient-evidence status, plain-language meaning, expandable criterion evidence, eligibility/readiness separately, and next step. Show source coverage by site, discovery API-attempt/reserved-and-observed-hosted-call/lead/direct-read/skipped counts, all logged dispositions, technical/source queue, draft links/review status, ledger/export read-back, current `.xlsx` download version, and run status. The completed discovery metric counts only ledger-persisted authoritative postings with a completed scored assessment, stable rank, and completed recommendation; needs-information, unverified, excluded, and targeted-update records do not count. Never present a score as offer probability or application approval, or a send attempt as email delivery.
- **Next task or recipient:** The signed-in student; H3 receives owner-scoped review-only draft links. T8 receives a digest-safe summary only for scheduled discovery after verified ledger and export persistence.
- **Complete when:** The student can see the result and any unresolved work. C1: Run Complete is allowed only when the workflow completion conditions are satisfied and storage verification succeeded.

## 4. Planned Tools

### Tool 1

- **Tool name:** record_and_present_results
- **Input:** Run context and collection snapshot; Discovery results; Opportunity results; Preparation results.
- **Output:** Verified collection update; Student run summary.
- **Implementation Route:** Authenticated Site/backend operations validate allowed owner-scoped rows/fields, conditionally commit the Supabase ledger and record versions, generate a versioned `.xlsx` snapshot and save it with draft artifacts in private Supabase Storage, read both ledger and export back, and render the summary in the student interface.
- **Integration approach:** Direct integration.
- **Role in this task:** Persist permitted ledger/evidence changes and present verified results through a fixed sequence. Acquire the per-student run/write lock so a scheduled and manual run cannot overwrite each other. Use run ID and opportunity ID as unique update keys, with draft ID/version for artifacts. Commit only owner-scoped rows under version checks, generate a new export without replacing prior snapshots, and read back intended rows and file. If a ledger commit succeeds but export generation or read-back fails, mark the run operationally incomplete and block T8 until the status is inspected; never label an earlier download current. Publishing a draft in the student's private Site view is not external communication.
- **Task timeout:** 60 seconds total for validation, writing, read-back, and presentation.
- **Maximum retries:** 0.
- **Retry only when:** Not applicable. A manually resumed run must first inspect the existing update key and stored result; it must not replay an uncertain write blindly.
- **On timeout, exhausted retries, or an error that cannot be retried:** Show the student the failed operation, affected IDs, intended changes, and whether ledger/export persistence is confirmed, failed, or unknown. If a write may have succeeded, allow only read-back inspection before further mutation. Retain failure evidence, stop additional writes, and mark the run incomplete until the issue is inspected and resolved. Do not claim a current spreadsheet snapshot, trigger T8, or claim C1 completion.
