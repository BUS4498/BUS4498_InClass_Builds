# Validate Opportunities Task Specification

> **Worked example:** Automation levels, tool names, data structures, and operating limits in this specification are proposed design defaults. The workflow's retention limits remain binding.

## Basic Information

- **Task ID:** T3
- **Task name:** Validate Opportunities
- **Task type:** Verify
- **Task owner:** Career Opportunity Prep Agent; the student resolves ambiguous constraints.
- **Automation level (proposed):** L1.

## 1. Task Description

Apply a fixed checklist to T2's discovery leads or T1's single targeted opportunity or saved pending candidate: a readable authoritative posting checked at a recorded time; matching employer/agency, role, source URL, and posting/job identifier when available; relevance to the student's chosen timeframe and role types; no supported hard-constraint conflict; and duplicate or material-change status. Authoritative means an employer career page, employer-authorized applicant-tracking-system posting for that job, or an official currently open USAJOBS announcement for a federal role. A job-board listing or search snippet alone does not satisfy source verification. Preserve lead and checked posting URLs separately. An employer page with unstated open status has unknown availability; an explicitly closed page or closed USAJOBS announcement is excluded.

Use the selected role types, chosen timeframe, and confirmed role interests for initial relevance. Reject a documented hard-constraint conflict or explicitly closed posting. Admit a source-verified candidate for assessment when employer/agency, role, posting identity, and initial relevance are supported and no explicit hard conflict is established. Missing posting facts such as exact dates, hours, work-authorization wording, compensation, or open status remain unknown; T4 cannot turn them into eligibility, readiness, or a conflict. If the posting lacks enough information to establish role or timeframe relevance, exclude it with a source next step. Hold a candidate only when a student-answerable ambiguity in selected role interests, timeframe, or constraints prevents the minimum admission check; name the exact question. Exclude an inaccessible, mismatched, or uncorroborated secondary source as unverified with a source/technical next step, not a student fitness question.

Match duplicates first by posting identifier or normalized source URL, then by exact employer, role, location, and internship period. Send ambiguous matches to the student. During discovery an unchanged duplicate is excluded. During a targeted update, a valid unchanged tracked opportunity is eligible for clarification or explicitly requested preparation after the same evidence, identity, and constraint checks. A tracked opportunity is materially changed when supported requirements, location, dates, deadline, compensation, or availability differ from its stored evidence; formatting changes alone do not qualify.

For discovery, validate every supplied lead within T2's 40-lead and 24-posting-read ceilings and pass all source-verified new or materially changed candidates to T4 in discovery order; T7 selects the final result groups after assessment, with up to five scored and three needing information. Do not fill either group with weak or unverified leads. Record additional verified candidates as assessed but not presented, or not processed if a later operational stop occurred. Process only T2-supplied leads, or exactly one persisted target for a targeted update; no new searches occur here. An unchanged discovery duplicate is logged but not reassessed without a material change; a valid unchanged targeted item may proceed. A saved pending candidate must pass the checklist before becoming a validated opportunity; resolve its identity against the owner-scoped hosted ledger before assigning or reusing an ID.

## 2. Inputs

### Input 1

- **Input name:** Candidate opportunity evidence
- **Contents and format:** For discovery, T2's list of at most 40 screened leads and 24 attempted posting reads, including source coverage, posting evidence, references, retrieval times, discovery order, and access status. For a targeted update, T1's exactly one tracked opportunity or saved pending candidate, versions, response or updated posting evidence, and prior validation status.
- **Source:** T2: Search Career Sources for discovery; T1: Retrieve Student Context for a targeted update.

### Input 2

- **Input name:** Search run log
- **Contents and format:** For discovery, run ID, fixed search intents, provider query strings when supplied or explicitly unavailable, counts, stopping reason, and any incomplete-search or service-error status. For a targeted update, explicitly not applicable, with zero discovery searches and zero new discovery candidates; the single revalidation target is counted separately.
- **Source:** T2: Search Career Sources for discovery; T1: Retrieve Student Context for a targeted update.

### Input 3

- **Input name:** Verified student context
- **Contents and format:** Source-labeled resume passages, student-selected timeframe and role types, search preferences, and explicit hard constraints, with confirmed values and unknowns distinct.
- **Source:** T1: Retrieve Student Context.

### Input 4

- **Input name:** Opportunity history
- **Contents and format:** Existing owner-scoped hosted ledger opportunity IDs, posting evidence, lead and authoritative URLs, prior dispositions, student decisions, and record versions.
- **Source:** T1: Retrieve Student Context.

- **If a required input is missing or invalid:** Missing required resume/scope context goes to H1 and blocks the run. A student-answerable relevance, constraint, or duplicate ambiguity is held with a specific question; T7 persists that candidate separately for a later zero-search targeted validation run. An inaccessible page or uncorroborated secondary source is excluded as unverified with its source/access reason, not placed in the needs-student-information group. Invalid counts or systemic unreadable input stop validation and are reported through T7.

## 3. Outputs

### Output 1

- **Output name:** Validated opportunity record
- **Contents and format:** One record per source-verified opportunity within the 24-read ceiling, or at most one targeted record, containing opportunity ID, employer/agency, role, lead and authoritative posting links, job identifier when available, source-labeled evidence, requirements, location, dates, deadline, compensation and availability when stated, verification time, validation status, and new, materially changed, or unchanged targeted status. Include prior record version and supported changes. List unknown posting and hard-constraint comparisons explicitly; source verification does not assert eligibility or readiness.
- **Next task or recipient:** T4: Assess Opportunity Fit, once for each validated candidate.
- **Complete when:** Every emitted record passes the checklist and has usable authoritative evidence. Discovery records are new or materially changed; a targeted tracked record may be unchanged. A zero-record result routes to T7.

### Output 2

- **Output name:** Validation results
- **Contents and format:** Run-level ledger of every screened lead: source-verified for assessment, excluded (closed, inaccessible, conflicting, or unverified), held for student-answerable validation clarification, or omitted by a global cap; reason, references, source coverage, changes, duplicate matches, candidate IDs, and unresolved questions. Include T2's actual discovery API attempts, reserved/observed hosted-search calls, observed provider queries or unavailable status, leads, skipped pages, application-controlled posting reads, and incomplete status. For a targeted update, record zero discovery attempts/leads, one supplied target, and revalidation disposition. T7 receives all dispositions for hosted ledger and `.xlsx` snapshot logging even when they never reach T4.
- **Next task or recipient:** T7: Record and Present Results and the student. Persist held unvalidated candidates separately with their question and evidence versions. A later student response references that pending-candidate ID through T1 and this task before T4; it does not bypass validation.
- **Complete when:** Every candidate has a traceable disposition, all held cases have a named next step, and zero qualifying results can be reported without fabrication.

## 4. Planned Tools

### Tool 1

- **Tool name:** validate_opportunities
- **Input:** Candidate opportunity evidence; Search run log; Verified student context; Opportunity history.
- **Output:** Validated opportunity record; Validation results.
- **Implementation Route:** Functions/scripts performing fixed field checks, explicit-value comparisons, source checks, duplicate matching, and retention limits over supplied records.
- **Integration approach:** Direct integration.
- **Role in this task:** Validate candidates using the checklist. The tool reads supplied evidence only; it does not turn absent resume/posting facts into failed qualifications, resolve ambiguity with assumptions, assess fit, browse for missing facts, or write the hosted ledger or spreadsheet snapshot.
- **Task timeout:** 60 seconds total across all supplied candidates.
- **Maximum retries:** 0.
- **Retry only when:** Not applicable.
- **On timeout, exhausted retries, or an error that cannot be retried:** Mark Validation results incomplete, identify unchecked candidates and the failed check, and hand the run to the student through T7. Do not route partially checked candidates to T4 or label validation successful.
