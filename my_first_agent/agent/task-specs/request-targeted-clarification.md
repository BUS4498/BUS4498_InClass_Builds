# Request Targeted Clarification Task Specification

> **Worked example:** Automation levels, tool names, data structures, and response deadlines in this specification are proposed design defaults. Clarification is limited to the identified opportunity.

## Basic Information

- **Task ID:** H2
- **Task name:** Request Targeted Clarification
- **Task type:** Retrieve
- **Task owner:** The student who owns the opportunity and application decisions.
- **Automation level (proposed):** L0; the student supplies evidence or exercises the reserved judgment. The planned tool only supports the handoff.

## 1. Task Description

Present the narrow evidence question or decision that prevents T4 from supporting an assessment for one opportunity. Show the relevant posting statement, available student evidence, conflict or unknown, and why the answer is needed. The student supplies a factual clarification, supporting evidence, or an explicit decision about a preference.

Do not turn unknown evidence into a qualification gap, assume eligibility, or relax constraints on the student's behalf. If the student cannot resolve the issue, keep it unresolved with a named next step. Stop affected autonomous work while awaiting the response; do not repeatedly ask the model or search the internship market.

A response for an already tracked opportunity starts a targeted update through T1 and then T4, with zero discovery searches. If the opportunity has not yet been tracked, retain the clarification with its candidate and validation references and have the student resolve its tracking status before using that shortcut. A clarification response alone is not validation, permission to fabricate a collection entry, or approval of final materials.

## 2. Inputs

### Input 1

- **Input name:** Targeted clarification request
- **Contents and format:** Opportunity ID or candidate ID, run ID, T4's escalated Status, Result or recommendation, Evidence summary, Unresolved issues, and Handoff note. Include the exact question, source references, prior clarification attempts, and whether the opportunity is already tracked.
- **Source:** T4: Assess Opportunity Fit. T5: Recommend Next Actions may route an escalated assessment here if it reaches T5 without resolution.

### Input 2

- **Input name:** Student opportunity response
- **Contents and format:** The student's answer, supporting document or posting evidence, explicit preference decision, or statement that the answer is unknown; linked to the same opportunity and clarification request. Include response time and evidence source. This input is absent until the student responds.
- **Source:** The student.

- **If a required input is missing or invalid:** Ask the workflow owner to correct an unidentified opportunity or unsupported question. Keep an absent, incomplete, or conflicting student response unresolved; do not treat it as a new verified qualification. If current posting evidence is needed, identify that evidence need explicitly rather than launching an unbounded search.

## 3. Outputs

### Output 1

- **Output name:** Student clarification
- **Contents and format:** Response record with opportunity or candidate ID, clarification ID, original run ID, exact question and answer, source references, response time, and explicit distinctions among new facts, preference decisions, and remaining unknowns.
- **Next task or recipient:** T1: Retrieve Student Context, then T4: Assess Opportunity Fit for a valid targeted update involving the already tracked opportunity.
- **Complete when:** The response is traceable to the correct issue and is ready for T1/T4 to examine. Receiving a response does not itself establish that the assessment is supported.

### Output 2

- **Output name:** Targeted handoff status
- **Contents and format:** Status awaiting student, response received, or still unresolved; identified opportunity; unanswered issue; responsible student; deadline; and the evidence or decision needed next. Preserve earlier attempts and answers.
- **Next task or recipient:** The student and the local pending-handoff record used by T1.
- **Complete when:** The question and current state are visible and affected assessment, recommendation, and preparation work remains paused until the required issue is resolved.

## 4. Planned Tools

### Tool 1

- **Tool name:** request_targeted_clarification
- **Input:** Targeted clarification request; Student opportunity response when provided.
- **Output:** Student clarification; Targeted handoff status.
- **Implementation Route:** File operations and functions/scripts to present the supplied evidence and question and record the student's explicit response.
- **Integration approach:** Direct integration.
- **Role in this task:** Support the human handoff for one opportunity. The tool cannot answer the question, research other opportunities, decide eligibility, update final materials, or expand the student's request.
- **Task timeout:** Human response deadline: one business day after assignment. The active automated run ends immediately on handoff; each supporting display or save operation has a five-second limit. Display any earlier posting deadline as context, without treating urgency as permission to proceed.
- **Maximum retries:** Not applicable — manual task.
- **Retry only when:** Not applicable.
- **On timeout, exhausted retries, or an error that cannot be retried:** Keep status awaiting student, mark the response overdue, and retain the exact unresolved question. A supporting tool failure is reported to the student with the affected clarification ID. Do not assume an answer, continue assessment, or describe the opportunity as resolved.
