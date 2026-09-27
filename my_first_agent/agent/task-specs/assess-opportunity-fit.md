# Assess Opportunity Fit Task Specification

> **Worked example:** This task is Level 3 because intermediate findings determine whether the agent should compare qualifications, examine a constraint, resolve an evidence gap, incorporate a student clarification, or form the assessment next. Those choices are bounded, and unresolved cases return to the student.

```yaml
# BASIC INFORMATION
task_id: "T4"
task_name: "Assess Opportunity Fit"
task_owner: "Career Opportunity Prep Agent; the student retains final decision authority"

# Agent Inference Configuration
Provider: OpenAI
Model: gpt-5.6-luna
Role: Interpret supplied evidence, select the next permitted subtask, and produce the evidence-backed assessment.
Maximum inference requests per task run: 6
On inference failure or exhausted limits: Record the unresolved status and hand the case to the student.
```

## 1. Task Goal

- **Objective:** Produce an understandable, evidence-backed 1–5 fit score or provisional range for one validated opportunity against the uploaded resume and confirmed student facts, with a criterion-by-criterion explanation of matches, partial matches, genuine gaps, and unknowns. Keep eligibility and preparation readiness separate. A source-verified posting with missing details can receive a bounded partial assessment; those unknowns cannot establish eligibility or readiness. If evidence is too sparse for a number, explain why rather than inventing a score, and identify a student-answerable question when one could materially change the assessment or rank.

## 2. Inbound Inputs

### Input 1

- **Input name:** Validated opportunity record
- **What it contains:** Employer/agency, role, authoritative posting and lead links, source-labeled evidence, requirements, location, dates, deadline, compensation when stated, and validation status for one new or changed discovery opportunity, or one revalidated target. Include run ID, opportunity ID, selected timeframe/role types, and record/evidence versions.
- **Source:** T3: Validate Opportunities

### Input 2

- **Input name:** Verified student context
- **What it contains:** Source-cited passages and version of the uploaded resume, student-confirmed corrections, selected timeframe and role types, preferences, work authorization, availability, and location constraints. Each fact carries its provenance and verification status; absence from the resume is not evidence of absence.
- **Source:** T1: Retrieve Student Context

### Input 3

- **Input name:** Opportunity history
- **What it contains:** Prior assessments, student decisions, unresolved questions, and material changes associated with the same opportunity. A valid empty history is expected for a new opportunity and is distinct from an unreadable or missing required input.
- **Source:** T1: Retrieve Student Context

### Input 4

- **Input name:** Student clarification
- **What it contains:** Any new answer or preparation request the student supplied for this opportunity. This input may be absent during an initial discovery run.
- **Source:** The student through a targeted update

## 3. Tool Permissions and Boundaries

### Task-Wide Limits

- **Total task timeout:** 120 seconds for one opportunity's task run, including tool calls, retries, and reasoning. A tool call or retry does not restart this clock. If student clarification is needed, record the candidate-level handoff and end this task; the controller may continue other candidates within the discovery run.
- **Maximum tool calls:** 6 calls across all tools during one task run; retries count toward this total. The subtask repetition and clarification limits in Section 4 also apply.

Tools may use only the supplied inputs for this opportunity. They may not conduct a new job search, follow external links to gather evidence, modify resume or opportunity records, email anyone, contact employers, or submit applications. The agent classifies evidence and prepares the Section 6 deliverable. The controller calculates the fit score and unrounded weighted fraction from the source-cited criterion ledger using Section 4's fixed rule; the model does not choose weights or supply an unchecked number.

### Tool 1

- **Tool name:** `retrieve_supplied_evidence`
- **Role in this task:** Support Compare Requirements, Evaluate Constraints, Examine Evidence Gaps, Incorporate Student Clarification, and Form Evidence-Backed Assessment by locating relevant passages in the supplied inputs.
- **Input:** Validated opportunity record; Verified student context; Opportunity history; Student clarification, when supplied.
- **Output:** Source-labeled excerpts for the Evidence summary, plus missing, stale, or conflicting evidence for Unresolved issues. Preserve the input name and available source reference for each excerpt.
- **Implementation Route:** File operations restricted to the local artifacts supplied as this task’s inputs.
- **Integration approach:** Direct integration.
- **Task timeout:** Subject to the same 120-second total task deadline. Each call may take at most 5 seconds or the remaining task time, whichever is shorter.
- **Maximum retries:** 1 additional attempt per invocation, subject to the task-wide call and time limits.
- **Retry only when:** A temporary file-access or read error prevents completion. Wait 2 seconds and retry only if enough time and call budget remain. Do not retry denied access, an invalid input reference, or a confirmed missing required artifact. An optional Student clarification that has not been supplied is not a read failure. This tool is read-only, so retries do not create duplicate records or messages.
- **On timeout, exhausted retries, or an error that cannot be retried:** Record the affected input, attempted operation, failure category, and attempts in Subtasks performed and Unresolved issues. Set Status to “Escalated to the student.” If a supported assessment cannot be produced, set Result or recommendation to “undetermined.” Use the Handoff note to identify the exact evidence or access correction needed. Do not treat an unreadable input as evidence that the student lacks a qualification.

### Tool 2

- **Tool name:** `check_explicit_constraints`
- **Role in this task:** Support Evaluate Constraints and Form Evidence-Backed Assessment by checking directly comparable, explicitly stated requirements against verified student constraints.
- **Input:** Validated opportunity record; Verified student context; Student clarification, when relevant and supplied.
- **Output:** Constraint findings for the Evidence summary, with supporting input references; unresolved or ambiguous comparisons for Unresolved issues.
- **Implementation Route:** Functions/scripts performing deterministic comparisons of explicit values, such as dates, available hours, and stated location preferences.
- **Integration approach:** Direct integration.
- **Task timeout:** Subject to the same 120-second total task deadline. Each call may take at most 5 seconds or the remaining task time, whichever is shorter.
- **Maximum retries:** 0.
- **Retry only when:** Not applicable. A later comparison using materially changed evidence is a new invocation, not a retry, and must remain within Section 4’s repetition limits and the task-wide budgets.
- **On timeout, exhausted retries, or an error that cannot be retried:** Record the failed comparison and its input references in Subtasks performed and Unresolved issues. Set Status to “Escalated to the student,” and identify the needed clarification in the Handoff note. Use “undetermined” for Result or recommendation when no supported assessment is possible. Do not interpret a processing error as a constraint conflict.

This second tool must return “unknown” when a comparison requires unstated assumptions, ambiguous eligibility interpretation, or relaxation of a student preference. It cannot invent missing values or make the student’s decision. It is read-only and creates no records or messages.


## 4. How the Agent Should Reason

### Permitted Subtask 1

- **Subtask name:** Compare Requirements
- **Subtask description:** List distinct posting qualifications as required, preferred, or unclear, counting duplicate restatements once; compare each with cited resume passages or confirmed student evidence; and classify it as matched, partly matched, documented gap, or unknown. Add one role-interest criterion only when confirmed preferences and posting duties support comparison. Give exact posting and student-evidence references when they exist; for an unknown, identify the absent evidence rather than inventing a reference.
- **Subtask boundary:** Use only the supplied posting, resume, and confirmed student context. Absence of a skill or experience from the resume is unknown, not a gap, unless the student explicitly confirmed absence or verified evidence establishes non-fulfillment. Do not infer an unstated qualification, convert coursework into employment experience, or decide the next action.
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
- **Subtask description:** Compare a new student response or confirmed resume correction with the unresolved issue, identify what it resolves, and determine whether the assessment can now be narrowed or completed.
- **Subtask boundary:** Treat the response as student-supplied evidence only for this opportunity. Do not turn it into a resume claim, final application content, or employer communication without the student's later review and approval.
- **Retry limits:** Incorporate the clarification supplied at task entry once. If more human input is needed, record the exact candidate question and end this task; other candidates may continue. A later explicit response starts a new bounded targeted run through T1, T3, and T4. Preserve clarification history; never relaunch an unanswered issue automatically.

### Permitted Subtask 5

- **Subtask name:** Form Evidence-Backed Assessment
- **Subtask description:** Synthesize the criterion ledger, constraints, unknowns, deadline, and urgency into an explainable fit and readiness assessment. The controller calculates the score or provisional range and unrounded ordering fraction using the fixed rule below. Flag material user-answerable unknowns and their effect on the score bounds; T7 decides final group and rank after comparing all candidates. Keep external posting unknowns separate.
- **Subtask boundary:** Do not invent a score, criterion, weight, source reference, or probability of receiving an offer; choose the next operational action; prepare application materials; or imply that an application will be submitted.
- **Retry limits:** Revise once only when another permitted subtask produces new material evidence or exposes an internal conflict.

For the fit score, required qualifications have weight 2; preferred qualifications and a supported role-interest alignment criterion have weight 1. An unclear posting qualification is a weight-2 unknown until clarified. For a known comparison, matched earns full weight, partly matched earns half, and a documented gap earns zero. An unknown earns zero in the lower bound and full weight in the upper bound; it is not a gap. Divide each bound by total included weight without rounding. Map each fraction to a 1–5 rating: 1 = 0% to under 20%, 2 = 20% to under 40%, 3 = 40% to under 60%, 4 = 60% to under 80%, and 5 = 80% to 100%. Show one rating if both bounds map to the same value, otherwise a provisional range. A number requires at least one posting qualification with a verifiable student comparison; role-interest alignment alone does not satisfy that minimum. Otherwise show `Insufficient evidence to rate` with the exact need. Preserve the unrounded fraction or bounds for T7's group and ranking decision. Flag user-answerable unknowns that could materially affect the score; T7 routes a rank-sensitive case to the needs-information group after all assessments are available. This score describes evidence-supported fit, not eligibility, readiness, or offer probability; hard conflicts and unknown eligibility are separate and cannot be overridden by a high score.

- **Decision guidance:** After each subtask, use its findings to select the permitted subtask most likely to resolve the most important remaining uncertainty. Do not follow a fixed sequence. If no permitted subtask can make useful progress, stop and hand the case to a person.

## 5. When to Stop or Hand Off to a Human

- **Stop successfully when:** Every material posting requirement and student constraint has been classified as supported, partially supported, unsupported, or unknown; the criterion ledger and score or `Insufficient evidence to rate` cite the relevant evidence; and each unknown's effect on the score range, eligibility, or readiness is stated. A supported partial assessment may complete with an unresolved external posting fact, but must label eligibility or readiness undetermined when that fact is necessary to decide it.
- **Hand off early when:** Missing, stale, or conflicting personal evidence prevents a meaningful assessment or stable rank; a proposed student claim lacks support; the clarification or gap limits are reached; or judgment requires student authority. Record a specific student-answerable question for H2 and end this candidate's task while other candidates continue. Do not ask the student to certify a missing employer fact; route that to a source/technical status. A hard conflict is a supported finding, not a tool failure.
- **Hand off to:** The student who owns the internship search and application decisions.

Stop at the first applicable budget limit or handoff condition. While awaiting review, take no further autonomous action.

## 6. Outbound Deliverable

- **Status:** Completed or escalated to the student. Accompany this deliverable with the controller-supplied run ID, opportunity ID, and record/evidence version references. On escalation, distinguish missing human evidence or judgment from an operational error, including inference failure, deadline exhaustion, or tool failure, so T7 can assign the run outcome without treating a failed operation as a successful assessment.
- **Result or recommendation:** An evidence-backed fit assessment with controller-checked 1–5 score, provisional range, or `Insufficient evidence to rate`, unrounded weighted fraction/bounds for T7's deterministic group/rank decision, and a short plain-language meaning; not an operational action recommendation. Mark complete or partial and flag material student-answerable unknowns. Keep fit, eligibility, and readiness distinct. If escalation prevented a supported result, write `undetermined` rather than a number.
- **Evidence summary:** A criterion table showing each distinct required, preferred, unclear, and supported role-interest item; its weight and matched/partly matched/gap/unknown classification; the exact posting reference and student-evidence reference when available or the specific missing evidence; and the contribution or uncertainty behind the score. Show hard constraints, unknown eligibility, deadline, urgency, and evidence that could change the result separately. Do not present a score without this explanation.
- **Subtasks performed:** The permitted subtasks completed, including any repeated assessment or clarification attempt.
- **Unresolved issues:** Remaining missing or conflicting evidence. Write `none` only when the task has been completed successfully with no unresolved issue.
- **Handoff note:** The reason for stopping, the exact unresolved question, and what the student needs to decide or provide; write `Not applicable` for a completed task.
- **Next task or recipient:** Send a completed assessment to T5: Recommend Next Actions. Send a user-answerable unresolved case to H2: Request Targeted Clarification for candidate-level pending state; the controller continues other candidates and T7 later persists all results and questions. A technical failure stops affected automation and keeps the run operationally incomplete even when a student question also exists.
