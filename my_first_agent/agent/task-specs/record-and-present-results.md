# Record and Present Results Task Specification

> **Worked example:** Automation levels, tool names, data structures, and operating limits in this specification are proposed design defaults. Only changes permitted by the existing workflow may be recorded.

## Basic Information

- **Task ID:** T7
- **Task name:** Record and Present Results
- **Task type:** Remember
- **Task owner:** Internship Application Prep Agent; the student owns the collection and approves decisions outside routine recording.
- **Automation level (proposed):** L1.

## 1. Task Description

Use fixed rules to assemble the run results, record permitted collection changes, read the saved result back, and present a traceable summary to the student.

For discovery, add validated new opportunities or supported material changes to existing opportunities, with their completed assessments, recommendations, and any requested review-only drafts. Preserve prior evidence and record versions. For a targeted update, change only the identified tracked opportunity's supported assessment, recommendation, clarification history, and requested draft records; do not add unrelated opportunities or start searches.

Recommendations are stored separately from student decisions. A recommendation to archive, apply, or follow up does not authorize changing an application status, sending a message, or performing the action. Do not replace student profile facts, overwrite final materials, or mark a draft approved without a version-specific student decision. This workflow does not submit applications or contact employers.

Write a run record even when no opportunity qualifies, explaining the shortfall and the actual search limits reached. Store unresolved cases as unresolved; a missing assessment is not a successful result. H1/H2 branches stop the active run before normal completion; if T7 receives an available partial result or failure record, it may record and present that state but cannot declare C1: Run Complete while a selected opportunity still lacks a supported assessment and recommendation. Drafts awaiting H3 review do not by themselves prevent completion of the collection run.

## 2. Inputs

### Input 1

- **Input name:** Run context and collection snapshot
- **Contents and format:** Run ID, trigger type, student request and scope, tracked opportunity IDs, existing record versions, and the local collection location. The snapshot distinguishes existing records from a valid empty collection.
- **Source:** T1: Retrieve Student Context.

### Input 2

- **Input name:** Discovery results
- **Contents and format:** T2's Search run log and T3's Validated opportunity records and Validation results, including all counts, dispositions, sources, shortfalls, and unresolved issues. For a targeted update, explicitly record not applicable, with zero discovery searches and zero new candidates.
- **Source:** T2: Search Internship Sources and T3: Validate Opportunities, when discovery applies.

### Input 3

- **Input name:** Opportunity results
- **Contents and format:** Each selected opportunity's T4 outbound assessment and T5 Next-action recommendation, plus unresolved handoffs when applicable. Include opportunity ID, evidence references, status, and existing version.
- **Source:** T4: Assess Opportunity Fit and T5: Recommend Next Actions.

### Input 4

- **Input name:** Preparation results
- **Contents and format:** T6's Review-only draft and Preparation handoff when preparation was requested; otherwise explicitly record not requested. Include draft IDs, versions, review status, and unresolved requests.
- **Source:** T6: Prepare Review-Only Materials.

- **If a required input is missing or invalid:** Stop the affected write, identify the missing or inconsistent result, and present the unresolved issue to the student. Reject out-of-scope changes, conflicting record versions, excess retention counts, and claims of success unsupported by saved evidence. Do not silently omit a selected opportunity or treat an absent draft as fulfilled preparation.

## 3. Outputs

### Output 1

- **Output name:** Verified collection update
- **Contents and format:** Versioned local collection and run record containing only permitted updates, prior-version references, assessment and recommendation evidence, requested draft references, unresolved statuses, and update time. Include a read-back result identifying exactly which intended fields and artifact versions matched storage.
- **Next task or recipient:** Local opportunity collection; T1: Retrieve Student Context on a later run.
- **Complete when:** All intended permitted writes are confirmed by read-back, no unrelated records changed, and the same run and opportunity identifiers cannot create duplicate entries.

### Output 2

- **Output name:** Student run summary
- **Contents and format:** Human-readable summary showing trigger type, actual search and candidate counts, retained opportunities, new or materially changed status, supported assessments, recommendations, source references, draft locations and review status, collection verification result, shortfalls, failures, and named next steps. Show run complete, awaiting student, or incomplete because of an operational error according to the evidence. A run-complete result expressly does not mean an application was submitted.
- **Next task or recipient:** The student; H3: Student Reviews and Approves Final Materials receives links to the specific review-only draft versions.
- **Complete when:** The student can see the result and any unresolved work. C1: Run Complete is allowed only when the workflow completion conditions are satisfied and storage verification succeeded.

## 4. Planned Tools

### Tool 1

- **Tool name:** record_and_present_results
- **Input:** Run context and collection snapshot; Discovery results; Opportunity results; Preparation results.
- **Output:** Verified collection update; Student run summary.
- **Implementation Route:** File operations and functions/scripts to validate allowed fields, compare record versions, save local records and draft artifacts, read them back, and render the summary in the student interface.
- **Integration approach:** Direct integration.
- **Role in this task:** Persist permitted changes and present verified results through a fixed sequence. Use the run ID and opportunity ID as the unique update key, with draft ID and version for artifacts. Write to a temporary local file, validate it, and replace the intended collection file only after the version check succeeds; preserve the previous version. Publishing a draft to the interface is not external communication.
- **Task timeout:** 30 seconds total for validation, writing, read-back, and presentation.
- **Maximum retries:** 0.
- **Retry only when:** Not applicable. A manually resumed run must first inspect the existing update key and stored result; it must not replay an uncertain write blindly.
- **On timeout, exhausted retries, or an error that cannot be retried:** Show the student the failed operation, affected IDs, intended changes, and whether persistence is confirmed, failed, or unknown. If a write may have succeeded, allow only read-back inspection before any further mutation. Retain the failure evidence, stop additional writes, and mark the run incomplete until the student resolves the issue. Do not claim a successful collection update or C1 completion.
