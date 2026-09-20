# Prepare Review-Only Materials Task Specification

> **Worked example:** Automation levels, tool names, data structures, and operating limits in this specification are proposed design defaults. Preparation always requires the student's explicit request.

## Basic Information

- **Task ID:** T6
- **Task name:** Prepare Review-Only Materials
- **Task type:** Act
- **Task owner:** Internship Application Prep Agent; the student reviews, edits, and approves any final materials.
- **Automation level (proposed):** L2.

## 1. Task Description

For one opportunity and an explicit student request, use one fixed model-supported operation to prepare a checklist, outline, or question worksheet grounded in the supplied posting and verified student evidence. The request determines the deliverable type before the model call. Use a predetermined prompt, produce the requested structure, and check the response against the evidence and review requirements.

Label every output "DRAFT TEMPLATE — STUDENT REVIEW REQUIRED." Clearly separate supported facts from visible prompts such as "STUDENT TO COMPLETE: add a verified example" and "UNKNOWN: posting does not state a deadline." Placeholders are permitted in the resulting student draft; they must never be presented as completed claims.

Do not fabricate qualifications, convert coursework into employment experience, write unsupported achievements, revise final application files, or describe the output as approved. This task provides preparation support only. The model cannot browse, choose tools, conduct new searches, contact employers, or submit applications. H3 handles review and approval. The run may finish with drafts awaiting review; finishing T6 or T7 does not constitute approval.

## 2. Inputs

### Input 1

- **Input name:** Student preparation request
- **Contents and format:** Explicit student instruction tied to one opportunity ID, naming a checklist, outline, or question worksheet and its intended scope. Include the request reference and time. A model recommendation alone is not a valid request.
- **Source:** The student, received through T1: Retrieve Student Context and passed with T5: Recommend Next Actions.

### Input 2

- **Input name:** Validated opportunity record
- **Contents and format:** Employer, role, source link, saved posting evidence, requirements, location, dates, deadline, compensation when stated, and validation status. Preserve unavailable facts as unknown.
- **Source:** T3: Validate Opportunities for discovery; T1: Retrieve Student Context for the single already tracked opportunity in a targeted update.

### Input 3

- **Input name:** Verified student context
- **Contents and format:** Relevant documented education, experience, skills, constraints, and preferences with source references and verification status. Any new clarification remains visibly student-supplied unless verified.
- **Source:** T1: Retrieve Student Context.

### Input 4

- **Input name:** Assessment and recommendation
- **Contents and format:** T4's completed evidence-backed fit and readiness assessment and T5's checked Next-action recommendation, with matches, gaps, unknowns, requested preparation scope, and evidence references.
- **Source:** T4: Assess Opportunity Fit and T5: Recommend Next Actions.

- **If a required input is missing or invalid:** Skip preparation when no explicit request exists. When preparation was requested but evidence or scope is missing or conflicting, record the exact question in Preparation handoff and stop affected preparation while awaiting the student. Do not fabricate an answer or produce a final-looking document to conceal the gap.

## 3. Outputs

### Output 1

- **Output name:** Review-only draft
- **Contents and format:** A Markdown checklist, outline, or question worksheet with the required draft label, run ID, opportunity ID, draft ID and version, request reference, supported facts with source references, visible student-completion prompts, unknowns, and a review checklist. The checklist asks the student to verify accuracy, remove or complete placeholders, confirm suitability, and make any final-content decisions.
- **Next task or recipient:** H3: Student Reviews and Approves Final Materials, and T7: Record and Present Results for permitted storage and presentation.
- **Complete when:** The requested artifact is within scope, supported claims are traceable, placeholders and unknowns are visible, and the draft is marked awaiting student review. Completion does not require or imply H3 approval.

### Output 2

- **Output name:** Preparation handoff
- **Contents and format:** Run ID, opportunity ID, preparation status prepared for review, skipped because not requested, or unresolved; the request reference; any missing evidence or failed check; and a specific question or next step assigned to the student. A prepared draft includes its draft ID and version.
- **Next task or recipient:** T7: Record and Present Results and the student; H3 receives the handoff with any valid review-only draft.
- **Complete when:** The workflow can account for the student's request and distinguish a review-ready draft from a blocked or skipped preparation step.

## 4. Planned Tools

### Tool 1

- **Tool name:** prepare_review_only_materials
- **Input:** Student preparation request; Validated opportunity record; Verified student context; Assessment and recommendation.
- **Output:** Review-only draft; Preparation handoff.
- **Implementation Route:** One web API call to the configured text-generation model, with functions/scripts for fixed request checks and validation of output structure, source references, draft labeling, and review status.
- **Integration approach:** Direct integration.
- **Role in this task:** Produce the requested preparation artifact in a fixed prompt-and-check sequence. Return the artifact to the workflow; T7 handles permitted persistence. No final application file is changed.
- **Task timeout:** 90 seconds total for one opportunity, including the model request and checks.
- **Maximum retries:** 0.
- **Retry only when:** Not applicable.
- **On timeout, exhausted retries, or an error that cannot be retried:** Mark Preparation handoff unresolved, record the failed operation and needed correction, and send it to the student through T7. An incomplete or invalid draft cannot be labeled review-ready or routed onward as successful.
