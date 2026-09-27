# Request Targeted Clarification Task Specification

> **Worked example:** Automation levels, tool names, data structures, and response deadlines in this specification are proposed design defaults. Clarification is limited to the identified opportunity.

## Basic Information

- **Task ID:** H2
- **Task name:** Request Targeted Clarification
- **Task type:** Retrieve
- **Task owner:** The student who owns the opportunity and application decisions.
- **Automation level (proposed):** L0; the student supplies evidence or exercises the reserved judgment. The planned tool only supports the handoff.

## 1. Task Description

Present the narrow student-answerable question that prevents a meaningful resume-to-posting assessment or could materially change one opportunity's rank. Show the posting criterion, available resume/confirmed evidence, conflict or unknown, and why the answer matters. The student supplies a factual clarification, corrected resume evidence, or an explicit preference decision. An external employer fact or inaccessible page is a source/technical issue, not a student fitness question.

Do not turn unknown evidence into a qualification gap, assume eligibility, or relax constraints for the student. If the student cannot resolve the issue, keep it unresolved with a named next step. Stop only the affected candidate's assessment and preparation while awaiting a response; the bounded discovery may continue with other candidates. Do not repeatedly ask the model or launch a new search.

A response for an already tracked opportunity starts a targeted update through T1, T3, and T4 after successful revalidation, with zero discovery searches. During the current discovery, hold this candidate with its evidence/version and question while other candidates continue; T7 persists all dispositions and the local spreadsheet before run completion. A held unvalidated candidate stays in separate pending state and must pass T3 after a response. A clarification response alone is not validation, permission to fabricate a spreadsheet entry, or approval of final materials.

## 2. Inputs

### Input 1

- **Input name:** Targeted clarification request
- **Contents and format:** Opportunity or candidate ID, run ID, T4's escalated or supported-partial Status, available provisional score range or insufficient-evidence status, Evidence summary, Unresolved issues, and Handoff note or checked T5 recommendation. Include the exact student-answerable question, resume/posting references, prior attempts, and whether the opportunity is tracked.
- **Source:** T4: Assess Opportunity Fit for an unresolved assessment; T5: Recommend Next Actions for a checked partial assessment with a material student-answerable question.

### Input 2

- **Input name:** Student opportunity response
- **Contents and format:** The student's answer, supporting document or posting evidence, explicit preference decision, or statement that the answer is unknown; linked to the same opportunity and clarification request. Include response time and evidence source. This input is absent until the student responds.
- **Source:** The student.

- **If a required input is missing or invalid:** Ask the workflow owner to correct an unidentified opportunity or unsupported question. Keep an absent, incomplete, or conflicting student response unresolved; do not treat it as a new verified qualification. If current posting evidence is needed, identify that evidence need explicitly rather than launching an unbounded search.

## 3. Outputs

### Output 1

- **Output name:** Student clarification
- **Contents and format:** Response record with opportunity or candidate ID, clarification ID, original run ID, exact question and answer, source references, response time, and explicit distinctions among new facts, preference decisions, and remaining unknowns.
- **Next task or recipient:** T1: Retrieve Student Context, then T3: Validate Opportunities and T4: Assess Opportunity Fit after successful validation of the single saved target, with zero discovery searches.
- **Complete when:** The response is traceable to the correct issue and is ready for T1/T3/T4 to examine. Receiving a response does not itself establish that the assessment is supported.

### Output 2

- **Output name:** Targeted handoff status
- **Contents and format:** Status awaiting student, response received, or still unresolved; identified opportunity; unanswered issue; responsible student; deadline; and the evidence or decision needed next. Preserve earlier attempts and answers.
- **Next task or recipient:** The student and T7 for persistence with the other candidate dispositions before the bounded run ends; T1 uses the saved handoff on a later targeted run.
- **Complete when:** The question and current state are visible and affected assessment, recommendation, and preparation work remains paused until the required issue is resolved.

## 4. Planned Tools

### Tool 1

- **Tool name:** request_targeted_clarification
- **Input:** Targeted clarification request; Student opportunity response when provided.
- **Output:** Student clarification; Targeted handoff status.
- **Implementation Route:** File operations and functions/scripts to present the supplied evidence and question and record the student's explicit response.
- **Integration approach:** Direct integration.
- **Role in this task:** Support the human handoff for one opportunity. The tool cannot answer the question, research other opportunities, decide eligibility, update final materials, or expand the student's request.
- **Task timeout:** Human response deadline: one business day after assignment. End this candidate's assessment immediately; other candidates may continue, then T7 persists all available results before the run ends. Never wait for a human response inside automation. Each supporting display/save operation has a five-second limit; T7 retains its own deadline. Show any earlier posting deadline as context without treating urgency as permission to proceed.
- **Maximum retries:** Not applicable — manual task.
- **Retry only when:** Not applicable.
- **On timeout, exhausted retries, or an error that cannot be retried:** Keep status awaiting student, mark the response overdue, and retain the exact unresolved question. A supporting tool failure is reported to the student with the affected clarification ID and makes the run operationally incomplete. A failed save cannot be described as a durable handoff. Do not assume an answer, continue assessment, or describe the opportunity as resolved.
