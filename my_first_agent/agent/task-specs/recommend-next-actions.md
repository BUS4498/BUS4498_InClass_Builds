# Recommend Next Actions Task Specification

> **Worked example:** Automation levels, tool names, data structures, and operating limits in this specification are proposed design defaults. The task ID, name, scope, and handoffs follow the existing workflow.

## Basic Information

- **Task ID:** T5
- **Task name:** Recommend Next Actions
- **Task type:** Decide
- **Task owner:** Career Opportunity Prep Agent; the student retains final career and application decisions.
- **Automation level (proposed):** L2.

## 1. Task Description

Use one fixed model-supported operation to turn each completed T4 assessment into an explainable next-action recommendation for that opportunity. Supply the resume-grounded assessment, opportunity history, and student request in a predetermined prompt; require a structured response; then check fields and evidence references. The model does not choose tools, rank the whole search set, or select a sequence of subtasks.

Choose one primary recommendation: prioritize, monitor, prepare, follow up, archive, or ask the student for input. Prioritize only when criterion evidence supports fit and readiness without an unresolved required eligibility or hard-constraint fact; monitor when an external posting fact or future condition needs checking; prepare when evidence supports an explicitly requested review-only artifact; follow up when the student has an identified action; archive only when supported constraints or a prior student decision justify recommending removal; and ask the student for input when the next choice needs a student-owned fact or judgment. For every assessed candidate, name a relevant optional preparation step when useful: resume refinement/tailoring, tailored cover-letter drafting, or interview practice with question-and-answer flip cards. This is advice, not an automatic draft request. A high score cannot override a documented required gap, hard conflict, or unknown eligibility, and a provisional range is not a confirmed high score. Do not ask the student to certify an employer's missing fact. State score evidence, uncertainty, and what could change the recommendation.

A recommendation is not execution authority. Archive does not change the spreadsheet's student decision, follow up does not send a message, and a recommendation cannot authorize T6. The workflow routes to T6 only on the student's explicit opportunity-specific request and supported evidence; otherwise it continues to the next validated candidate. When a supported partial assessment has a material student-answerable unknown, send its exact question to H2 after producing the checked recommendation; T7 later decides whether the resulting range affects final rank and belongs in the needs-information group. A missing employer fact goes to the source queue. Those candidate-level pending items do not block a completed discovery run. A technical recommendation failure does.

## 2. Inputs

### Input 1

- **Input name:** Evidence-backed fit and readiness assessment
- **Contents and format:** T4's complete outbound deliverable: Status, Result or recommendation (including controller-checked 1–5 score/range or `Insufficient evidence to rate`, unrounded ordering fraction/bounds, and partial status), criterion evidence from the posting, resume, or confirmed student fact, Unresolved issues, Handoff note, and Next task or recipient. An escalated or undetermined result is not complete.
- **Source:** T4: Assess Opportunity Fit.

### Input 2

- **Input name:** Opportunity history
- **Contents and format:** Prior assessments, recommendations, student decisions, material changes, and open questions for the same opportunity, with source references and record version. A valid empty history is expected for a new opportunity; an unreadable or missing required history input is a different condition.
- **Source:** T1: Retrieve Student Context.

### Input 3

- **Input name:** Student clarification
- **Contents and format:** The student's current answer, decision, or preparation request, with opportunity ID and requested scope; explicitly absent when none was supplied. Only an explicit preparation request authorizes the T6 branch.
- **Source:** The student, packaged by T1: Retrieve Student Context for this run.

- **If a required input is missing or invalid:** Do not generate an action recommendation from an escalated or undetermined T4 result. Route a student-answerable question to H2 for that candidate and continue the bounded discovery on other candidates. Route an external source gap to the source/technical queue. A missing or inconsistent ID, unsupported recommendation, or invalid model response is an operational failure through T7; do not continue to preparation as if successful.

## 3. Outputs

### Output 1

- **Output name:** Next-action recommendation
- **Contents and format:** Structured record with run ID, opportunity ID, primary action, concise rationale, T4 fit score/range or insufficient-evidence status, supporting criterion and assessment references, completeness, separate eligibility/readiness, constraints and unknowns, deadline when supported, suggested next step, responsible person, and optional resume-tailoring/cover-letter/interview-card preparation suggestion with evidence. Identify whether a question concerns the student's fact or an external posting. Include preparation_requested as a factual flag from the student's explicit request, requested artifact type, and status. Keep recommendation separate from the student's decision and T7 ranking.
- **Next task or recipient:** H2 for a checked result with a material student-answerable question; T6 only if explicitly requested and supported without that blocking question; otherwise the workflow handles the next validated candidate and passes this record to T7 for grouping, ranking, spreadsheet persistence, and display.
- **Complete when:** The action uses an allowed label, follows the supplied assessment, has traceable support, and conveys neither automatic approval nor a claim that the action has been performed.

### Output 2

- **Output name:** Recommendation handoff
- **Contents and format:** Exception record containing run ID, opportunity ID, status, missing or conflicting input, exact question or failed check, and the next step required of the student. Include any model or processing failure without inventing a recommendation.
- **Next task or recipient:** H2: Request Targeted Clarification for an unresolved assessment or a checked partial assessment with a material student-answerable question; otherwise the student through T7: Record and Present Results.
- **Complete when:** The unresolved decision or failure is visible, its owner is named, and affected downstream work has stopped for that candidate; unrelated candidates continue only when the issue is human information rather than an operational failure.

## 4. Planned Tools

### Tool 1

- **Tool name:** recommend_next_actions
- **Input:** Evidence-backed fit and readiness assessment; Opportunity history; Student clarification.
- **Output:** Next-action recommendation; Recommendation handoff when unresolved.
- **Implementation Route:** One web API call to the configured text-generation model, with functions/scripts for fixed input checks and output-field, action-label, and source-reference validation.
- **Integration approach:** Direct integration.
- **Role in this task:** Produce one recommendation from supplied evidence in a fixed prompt-and-check sequence. The model has no tool access; the operation cannot search, send communications, change records, or select additional reasoning steps.
- **Task timeout:** 60 seconds total for one opportunity, including the model request and validation.
- **Maximum retries:** 0.
- **Retry only when:** Not applicable.
- **On timeout, exhausted retries, or an error that cannot be retried:** Record the failure category and affected opportunity in Recommendation handoff, mark the task unresolved and the run operationally incomplete, and hand the case to the student through T7. T7 saves available results and marks any remaining selected work not processed. Do not generate another model request or route to T6 on an unvalidated result.
