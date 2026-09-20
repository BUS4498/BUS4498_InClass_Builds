# Student Reviews and Approves Final Materials Task Specification

> **Worked example:** Automation levels, tool names, data structures, and response deadlines in this specification are proposed design defaults. Approval is a student decision tied to a specific artifact version.

## Basic Information

- **Task ID:** H3
- **Task name:** Student Reviews and Approves Final Materials
- **Task type:** Verify
- **Task owner:** The student who owns the application and final materials.
- **Automation level (proposed):** L0; the student checks, edits, and decides whether the material is ready.

## 1. Task Description

The student reviews the T6 checklist, outline, or question worksheet against the supplied posting and their verified evidence. They confirm factual accuracy, assess relevance and tone, complete or remove visible placeholders, resolve conflicting claims, and decide whether to approve a specific student-completed version for its stated purpose.

The student may approve, request changes, or decline. The preparation draft remains under review until that explicit decision exists. Approval applies only to the reviewed version; later edits require a new review. An approved checklist or outline is not approval of a later application document derived from it. The student controls final edits and any final application materials.

This review can occur after the collection run ends. T7 reporting a run complete does not approve a draft. Neither a review decision nor completion of this task sends material, contacts an employer, or authorizes the system to submit an application.

## 2. Inputs

### Input 1

- **Input name:** Review-only draft
- **Contents and format:** T6's labeled checklist, outline, or question worksheet with opportunity ID, draft ID and version, request reference, evidence references, visible placeholders, unknowns, and review checklist.
- **Source:** T6: Prepare Review-Only Materials, with a stored artifact link presented by T7: Record and Present Results.

### Input 2

- **Input name:** Review evidence
- **Contents and format:** The posting evidence, verified student facts, completed fit assessment, recommendation, and student preparation request that support the draft. Preserve the source and version of each item.
- **Source:** T1: Retrieve Student Context; T3: Validate Opportunities or the tracked record loaded by T1; T4: Assess Opportunity Fit; and T5: Recommend Next Actions.

### Input 3

- **Input name:** Student review response
- **Contents and format:** Human-entered decision approve, request changes, or decline; the exact artifact and version reviewed; review time; intended use; corrections or unresolved questions; and a student-edited version if applicable. This input is absent until the student reviews the material.
- **Source:** The student.

- **If a required input is missing or invalid:** Keep status awaiting review when the draft, supporting evidence, or student decision is unavailable. Request missing evidence or a readable version from the student or workflow owner. An approval without an identifiable reviewed version cannot release the material for use. Unresolved factual claims or unfinished placeholders require correction before approval of final content.

## 3. Outputs

### Output 1

- **Output name:** Student review decision
- **Contents and format:** Review record with opportunity ID, draft ID, reviewed version, reviewer, decision, timestamp, intended use, and any requested corrections. On approval, identify the exact student-completed artifact version approved. On request changes or decline, record the reason and next step. Silence remains awaiting review.
- **Next task or recipient:** The student and the local review record associated with the draft; T1: Retrieve Student Context may read that decision on a later run.
- **Complete when:** The student's explicit decision is linked to the correct version and accurately distinguishes approved content, requested changes, declined content, and pending review.

### Output 2

- **Output name:** Reviewed materials or revision request
- **Contents and format:** Either the specific student-approved artifact version with its review record, or the draft marked changes requested or declined with the student's comments. Preserve the original review-only draft and its source references.
- **Next task or recipient:** The student for their own subsequent use. Further agent preparation requires a new explicit request through T1, T4, T5, and T6 for the tracked opportunity.
- **Complete when:** Only the exact approved version is identified as approved; unapproved versions remain visibly restricted, and no employer communication or application submission has occurred.

## 4. Planned Tools

### Tool 1

- **Tool name:** record_student_review
- **Input:** Review-only draft; Review evidence; Student review response when provided.
- **Output:** Student review decision; Reviewed materials or revision request.
- **Implementation Route:** File operations and functions/scripts to display versioned artifacts and evidence and record the student's review choice and student-edited artifact reference.
- **Integration approach:** Direct integration.
- **Role in this task:** Support human review and capture its result. The tool does not evaluate claims for the student, supply approval, edit final materials, remove review restrictions from an unapproved version, or transmit anything externally.
- **Task timeout:** Human response deadline: two business days after assignment. This is a review target, not an automatic approval deadline. Each supporting display or save operation has a five-second limit; no automated run waits indefinitely.
- **Maximum retries:** Not applicable — manual task.
- **Retry only when:** Not applicable.
- **On timeout, exhausted retries, or an error that cannot be retried:** Keep the draft awaiting review and mark the target date overdue. If recording the decision fails or its outcome is uncertain, report the affected draft and version to the student and confirm the saved review record before displaying approval. Do not infer consent, overwrite the original draft, send materials, or submit an application.
