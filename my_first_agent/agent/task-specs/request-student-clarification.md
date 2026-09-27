# Request Student Clarification Task Specification

> **Worked example:** Automation levels, tool names, data structures, and response deadlines in this specification are proposed design defaults. Human responses remain under the student's control.

## Basic Information

- **Task ID:** H1
- **Task name:** Request Student Clarification
- **Task type:** Retrieve
- **Task owner:** The student who owns the internship search.
- **Automation level (proposed):** L0; the student supplies and confirms the missing information. The planned tool only supports the handoff.

## 1. Task Description

Present a specific question when T1 cannot establish a readable uploaded resume, confirmed extraction, selected timeframe/role types, or another required search context, and let the student supply, correct, or confirm it. Show the missing or conflicting item and its source so the student can answer without guessing what the workflow needs. Do not require optional resume facts such as work authorization merely to begin discovery; keep them unknown for later assessment.

The student determines their resume facts, timeframe, role types, and constraints. Software may display the request and capture a response, but it cannot choose these values, infer consent, relax a preference, or treat silence as confirmation. Pause dependent discovery and persist the request before ending the active run. Use a separate owner-scoped Supabase pending-handoff record when T1 cannot load the opportunity ledger but the handoff store remains available. End as awaiting student for a human-input gap, or operationally incomplete if a required automated operation or handoff save failed; keep the question visible. A later response starts a new run through T1.

## 2. Inputs

### Input 1

- **Input name:** Context clarification request
- **Contents and format:** Run ID, affected input, missing or conflicting context, exact question or access correction, relevant source references, and any existing values that need confirmation.
- **Source:** T1: Retrieve Student Context. T2: Search Career Sources or T3: Validate Opportunities may also identify an invalid required context item and use the same handoff.

### Input 2

- **Input name:** Student-supplied correction
- **Contents and format:** The student's answer, corrected uploaded source, access correction, or explicit statement that the information is unavailable, with response time and a reference to the clarification request. This input is absent until the student responds.
- **Source:** The student.

- **If a required input is missing or invalid:** If the request does not identify an answerable question, keep the case blocked and return it to the workflow owner for correction. If the student response is absent, incomplete, or conflicts with existing evidence, keep status awaiting student and identify the unresolved item. Do not substitute an assumed answer.

## 3. Outputs

### Output 1

- **Output name:** Student context response
- **Contents and format:** Human-authored response record linking the clarification ID and run ID to the supplied information, supporting source, response time, and whether the student explicitly confirmed or corrected a value. Preserve conflicting earlier evidence for review rather than silently replacing it.
- **Next task or recipient:** T1: Retrieve Student Context on a new student-triggered run.
- **Complete when:** The student has answered the specific question or explicitly identified what remains unavailable, and the response is associated with the correct request. T1 still checks whether the response permits continuation.

### Output 2

- **Output name:** Context handoff status
- **Contents and format:** Clarification ID, original run ID, status awaiting student, response received, or still unresolved; question, responsible student, assignment time, response deadline, and next step. An unanswered deadline is marked overdue and awaiting student.
- **Next task or recipient:** The signed-in student and the separate owner-scoped pending-handoff record used by T1.
- **Complete when:** The pending state or received response is saved and visible, with its identifiers and question checked against storage, and no dependent search or assessment continues while required context is missing.

## 4. Planned Tools

### Tool 1

- **Tool name:** request_student_clarification
- **Input:** Context clarification request; Student-supplied correction when provided.
- **Output:** Student context response; Context handoff status.
- **Implementation Route:** Authenticated Site operations display the handoff and save the student's explicit response in a separate owner-scoped Supabase record, with read-back before reporting it durable.
- **Integration approach:** Direct integration.
- **Role in this task:** Show the evidence and question, capture the student's answer, and retain a pending status. The tool supplies no answer and makes no substantive judgment about the student's facts or preferences.
- **Task timeout:** Human response deadline: one business day after assignment. The active automated run ends immediately on handoff; each supporting display or save operation has a five-second limit.
- **Maximum retries:** Not applicable — manual task.
- **Retry only when:** Not applicable.
- **On timeout, exhausted retries, or an error that cannot be retried:** When the human response deadline passes, keep the case awaiting student and mark the deadline overdue. A supporting display or save failure makes the run operationally incomplete and is shown to the student with the clarification ID; a failed save is not recorded as a received answer or durable handoff. Do not send automatic reminders, infer approval, or restart the workflow without a valid student response.
