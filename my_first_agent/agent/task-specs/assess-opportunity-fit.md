# Assess Opportunity Fit Task Specification

> **Worked example:** This task is Level 3 because intermediate findings determine whether the agent should compare qualifications, examine a constraint, resolve an evidence gap, incorporate a student clarification, or form the assessment next. Those choices are bounded, and unresolved cases return to the student.

```yaml
# BASIC INFORMATION
task_id: "T4"
task_name: "Assess Opportunity Fit"
task_owner: "Internship Application Prep Agent; the student retains final decision authority"
```

## 1. Task Goal

- **Objective:** Produce an evidence-backed assessment of one validated internship opportunity that distinguishes strong matches, partial matches, genuine gaps, and unknowns and gives the next task a reliable basis for recommending an action without inventing student qualifications.

## 2. Inbound Inputs

### Input 1

- **Input name:** Validated opportunity record
- **What it contains:** The employer, role, source link, posting evidence, requirements, location, dates, deadline, compensation when stated, and validation status for one new or materially changed opportunity.
- **Source:** T3: Validate Opportunities

### Input 2

- **Input name:** Verified student context
- **What it contains:** The student's documented education, experience, skills, work authorization, availability, location constraints, and career preferences.
- **Source:** T1: Retrieve Student Context

### Input 3

- **Input name:** Opportunity history
- **What it contains:** Prior assessments, student decisions, unresolved questions, and material changes associated with the same tracked opportunity.
- **Source:** T1: Retrieve Student Context

### Input 4

- **Input name:** Student clarification
- **What it contains:** Any new answer or preparation request the student supplied for this opportunity. This input may be absent during an initial discovery run.
- **Source:** The student through a targeted update

## 3. Tool Permissions and Boundaries

## 4. How the Agent Should Reason

### Permitted Subtask 1

- **Subtask name:** Compare Requirements
- **Subtask description:** Classify relevant posting statements as required, preferred, or unclear; compare each with verified student evidence; and produce documented matches, partial matches, gaps, and unknowns.
- **Subtask boundary:** Use only the supplied posting and verified student context. Do not infer an unstated qualification, convert coursework into employment experience, or decide the next action.
- **Retry limits:** Perform once with the current evidence. Repeat once only after receiving new material evidence.

### Permitted Subtask 2

- **Subtask name:** Evaluate Constraints
- **Subtask description:** Examine location, work arrangement, dates, hours, work authorization, compensation, deadline, and urgency and identify any supported conflict or unresolved constraint.
- **Subtask boundary:** Apply only explicit student constraints and posting facts. Keep missing facts unknown and do not decide on the student's behalf whether to relax a preference.
- **Retry limits:** Perform once with the current evidence. Repeat once only after a relevant posting update or student clarification.

### Permitted Subtask 3

- **Subtask name:** Examine Evidence Gaps
- **Subtask description:** Identify the most consequential missing, stale, or conflicting evidence and formulate the narrow question or evidence need that could resolve it.
- **Subtask boundary:** Examine only the supplied inputs. Do not launch a broad internship search, guess an answer, or request information unrelated to the current opportunity.
- **Retry limits:** Examine no more than two distinct material gaps before handing the case to the student.

### Permitted Subtask 4

- **Subtask name:** Incorporate Student Clarification
- **Subtask description:** Compare a new student response with the unresolved issue, identify what the response resolves, and determine whether the assessment can now be narrowed or completed.
- **Subtask boundary:** Treat the response as student-supplied evidence only for this opportunity. Do not turn it into a resume claim, final application content, or employer communication without the student's later review and approval.
- **Retry limits:** Allow no more than two clarification cycles for the same unresolved issue during one task run.

### Permitted Subtask 5

- **Subtask name:** Form Evidence-Backed Assessment
- **Subtask description:** Synthesize the available matches, gaps, constraints, unknowns, deadline, and urgency into an explainable fit and readiness assessment.
- **Subtask boundary:** Do not use an unexplained numerical score, choose the next operational action, prepare application materials, or imply that an application will be submitted.
- **Retry limits:** Revise once only when another permitted subtask produces new material evidence or exposes an internal conflict.

- **Decision guidance:** After each subtask, use its findings to select the permitted subtask most likely to resolve the most important remaining uncertainty. Do not follow a fixed sequence. If no permitted subtask can make useful progress, stop and hand the case to a person.

## 5. When to Stop or Hand Off to a Human

- **Stop successfully when:** Every material posting requirement and student constraint has been classified as supported, partially supported, unsupported, or unknown; the assessment cites the relevant evidence; and any remaining unknown is clearly stated and does not prevent a bounded assessment.
- **Hand off early when:** A material requirement or constraint is missing, stale, or conflicting; an eligibility question cannot be answered from explicit evidence; a proposed student claim lacks support; the clarification or gap limits have been reached; or the next judgment would require the agent to exercise authority reserved for the student.
- **Hand off to:** The student who owns the internship search and application decisions.

Stop at the first applicable budget limit or handoff condition. While awaiting review, take no further autonomous action.

## 6. Outbound Deliverable

- **Status:** Completed or escalated to the student.
- **Result or recommendation:** An evidence-backed fit and readiness assessment, not an operational action recommendation. If the task was escalated before reaching a supported result, write `undetermined`.
- **Evidence summary:** The strongest matches, partial matches, genuine gaps, constraints, unknowns, deadline, and urgency, each tied to the supplied posting or verified student evidence.
- **Subtasks performed:** The permitted subtasks completed, including any repeated assessment or clarification attempt.
- **Unresolved issues:** Remaining missing or conflicting evidence. Write `none` only when the task has been completed successfully with no unresolved issue.
- **Handoff note:** The reason for stopping, the exact unresolved question, and what the student needs to decide or provide; write `Not applicable` for a completed task.
- **Next task or recipient:** Send a completed assessment to T5: Recommend Next Actions. Send an unresolved case to the student.
