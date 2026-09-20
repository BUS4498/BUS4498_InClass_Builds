# Validate Opportunities Task Specification

> **Worked example:** Automation levels, tool names, data structures, and operating limits in this specification are proposed design defaults. The workflow's retention limits remain binding.

## Basic Information

- **Task ID:** T3
- **Task name:** Validate Opportunities
- **Task type:** Verify
- **Task owner:** Internship Application Prep Agent; the student resolves ambiguous constraints.
- **Automation level (proposed):** L1.

## 1. Task Description

Apply a fixed checklist to T2's candidates: usable public posting evidence; identifiable employer, role, and source; internship relevance to the stated search; explicitly comparable hard constraints; and duplicate or material-change status. Accept only facts supported by the saved posting evidence. Search snippets alone do not satisfy source verification.

Use explicit role-interest terms and internship-period statements for initial relevance. Reject a documented hard-constraint conflict or explicitly closed posting. A missing or ambiguous fact is unknown, not a failed qualification. If a required relevance or hard-constraint check cannot be resolved from explicit values, hold that candidate for clarification; do not infer eligibility. Optional missing fields, such as compensation when the student has not made it a hard constraint, can remain unknown in a retained record.

Match duplicates first by posting identifier or normalized source URL, then by exact employer, role, location, and internship period. Send ambiguous matches to the student. An unchanged duplicate is excluded. A tracked opportunity is materially changed when supported requirements, location, dates, deadline, compensation, or availability differ from its stored evidence; formatting changes alone do not qualify.

Retain valid new or materially changed opportunities in T2's discovery order, up to five. Retain three to five when at least three qualify; return one, two, or zero when fewer qualify. Never fill the list with weak candidates. Record any additional qualified candidates as omitted because of the cap. Process only the candidates T2 supplied; no new searches occur here.

## 2. Inputs

### Input 1

- **Input name:** Candidate opportunity evidence
- **Contents and format:** T2's list of at most 15 screened candidates, including posting evidence, source references, retrieval times, discovery order, and access status.
- **Source:** T2: Search Internship Sources.

### Input 2

- **Input name:** Search run log
- **Contents and format:** Run ID, fixed queries, counts, stopping reason, and any incomplete-search or service-error status.
- **Source:** T2: Search Internship Sources.

### Input 3

- **Input name:** Verified student context
- **Contents and format:** Source-labeled search preferences and explicit hard constraints, with verified values and unknowns kept distinct.
- **Source:** T1: Retrieve Student Context.

### Input 4

- **Input name:** Opportunity history
- **Contents and format:** Existing opportunity IDs, posting evidence, public source URLs, previously recorded fields, student decisions, and record versions.
- **Source:** T1: Retrieve Student Context.

- **If a required input is missing or invalid:** Missing or conflicting student context goes to H1: Request Student Clarification and blocks the run. Candidate-specific evidence or duplicate ambiguity is placed on hold with a specific question for the student in Validation results; it does not become a validated opportunity. Invalid candidate counts or unreadable source inputs stop validation and are reported to the student through T7.

## 3. Outputs

### Output 1

- **Output name:** Validated opportunity record
- **Contents and format:** One record per retained opportunity, at most five, containing opportunity ID, employer, role, source link, source-labeled posting evidence, requirements, location, dates, deadline, compensation when stated, verification time, validation status, and new or materially changed status. Include the existing record version and supported field changes for a tracked opportunity. List permitted unknowns explicitly.
- **Next task or recipient:** T4: Assess Opportunity Fit, once for each retained opportunity.
- **Complete when:** Every retained record passes the checklist, is new or materially changed, has usable evidence, and falls within the retention cap. A zero-record result routes to T7.

### Output 2

- **Output name:** Validation results
- **Contents and format:** Run-level ledger of every supplied candidate: retained, excluded, held for clarification, or qualified but omitted because of the cap; supporting reason and source references; material changes; duplicate matches; selected IDs; unresolved questions; and retained count. Include T2's actual search counts and incomplete-search status, and explain any shortfall below three without implying that more candidates were searched.
- **Next task or recipient:** T7: Record and Present Results and the student. A later student response for a held, untracked candidate requires validation before T4; it cannot use the tracked-opportunity shortcut.
- **Complete when:** Every candidate has a traceable disposition, all held cases have a named next step, and zero qualifying results can be reported without fabrication.

## 4. Planned Tools

### Tool 1

- **Tool name:** validate_opportunities
- **Input:** Candidate opportunity evidence; Search run log; Verified student context; Opportunity history.
- **Output:** Validated opportunity record; Validation results.
- **Implementation Route:** Functions/scripts performing fixed field checks, explicit-value comparisons, source checks, duplicate matching, and retention limits over supplied records.
- **Integration approach:** Direct integration.
- **Role in this task:** Validate and select candidates using the stated checklist. The tool reads supplied evidence only; it does not resolve ambiguous language with assumptions, assess nuanced fit, browse for missing facts, or change the collection.
- **Task timeout:** 30 seconds total across all supplied candidates.
- **Maximum retries:** 0.
- **Retry only when:** Not applicable.
- **On timeout, exhausted retries, or an error that cannot be retried:** Mark Validation results incomplete, identify unchecked candidates and the failed check, and hand the run to the student through T7. Do not route partially checked candidates to T4 or label validation successful.
