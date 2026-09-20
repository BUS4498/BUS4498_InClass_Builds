# Recommend Next Actions Task Specification

> **Worked example:** Automation levels, tool names, data structures, and operating limits in this specification are proposed design defaults. The task ID, name, scope, and handoffs follow the existing workflow.

## Basic Information

- **Task ID:** T5
- **Task name:** Recommend Next Actions
- **Task type:** Decide
- **Task owner:** Internship Application Prep Agent; the student retains final career and application decisions.
- **Automation level (proposed):** L2.

## 1. Task Description

Use one fixed model-supported operation to turn a completed T4 assessment into an explainable next-action recommendation for one opportunity. Supply the assessment, opportunity history, and student request in a predetermined prompt; require a structured response; then check its required fields and evidence references. The model does not choose tools or a sequence of subtasks.

Choose one primary recommendation: prioritize, monitor, prepare, follow up, archive, or ask the student for input. Prioritize when the supplied assessment supports fit and readiness; monitor when an unresolved future condition or timing issue warrants review; prepare when evidence supports preparation and the student has explicitly requested it; follow up when the student has an identified outstanding action; archive when supported constraints or prior student decisions justify recommending removal from active consideration; and ask the student for input when the next choice requires information or judgment reserved for the student. State the evidence and any uncertainty rather than using an unexplained score.

A recommendation is not execution authority. In particular, archive does not change collection status, follow up does not send a message, and a recommendation cannot authorize T6. The surrounding workflow routes to T6 only when the student explicitly requested preparation and required evidence supports that work. Otherwise it proceeds to the next selected opportunity or T7. A missing preparation input produces a student handoff, not an invented answer.

## 2. Inputs

### Input 1

- **Input name:** Evidence-backed fit and readiness assessment
- **Contents and format:** T4's complete outbound deliverable: Status, Result or recommendation, Evidence summary, Subtasks performed, Unresolved issues, Handoff note, and Next task or recipient. It must identify the opportunity and cite supplied posting and student evidence.
- **Source:** T4: Assess Opportunity Fit.

### Input 2

- **Input name:** Opportunity history
- **Contents and format:** Prior assessments, recommendations, student decisions, material changes, and open questions for the same opportunity, with source references and record version.
- **Source:** T1: Retrieve Student Context.

### Input 3

- **Input name:** Student clarification
- **Contents and format:** The student's current answer, decision, or preparation request, with opportunity ID and requested scope; explicitly absent when none was supplied. Only an explicit preparation request authorizes the T6 branch.
- **Source:** The student, packaged by T1: Retrieve Student Context for this run.

- **If a required input is missing or invalid:** Do not generate an action recommendation from an escalated or undetermined T4 result. Route the assessment's exact evidence question to H2: Request Targeted Clarification and stop. A missing or inconsistent opportunity ID, unsupported recommendation, or invalid model response is recorded as unresolved and handed to the student through T7; do not continue to preparation as if the task succeeded.

## 3. Outputs

### Output 1

- **Output name:** Next-action recommendation
- **Contents and format:** Structured record with run ID, opportunity ID, primary action, concise rationale, supporting assessment references, constraints and unknowns, deadline or timing when supported, suggested next step, and responsible person. Include preparation_requested as a factual flag from the student's request, requested scope, and status completed or awaiting student. Keep recommended action separate from any actual student decision.
- **Next task or recipient:** T6: Prepare Review-Only Materials if explicitly requested and supported; otherwise the workflow handles the next selected opportunity and eventually passes this record to T7: Record and Present Results.
- **Complete when:** The action uses an allowed label, follows the supplied assessment, has traceable support, and conveys neither automatic approval nor a claim that the action has been performed.

### Output 2

- **Output name:** Recommendation handoff
- **Contents and format:** Exception record containing run ID, opportunity ID, status, missing or conflicting input, exact question or failed check, and the next step required of the student. Include any model or processing failure without inventing a recommendation.
- **Next task or recipient:** H2: Request Targeted Clarification for an unresolved assessment; otherwise the student through T7: Record and Present Results.
- **Complete when:** The unresolved decision or failure is visible, its owner is named, and affected downstream work has stopped.

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
- **On timeout, exhausted retries, or an error that cannot be retried:** Record the failure category and affected opportunity in Recommendation handoff, mark the task unresolved, and hand the case to the student through T7. Do not generate another model request or route to T6 on an unvalidated result.
