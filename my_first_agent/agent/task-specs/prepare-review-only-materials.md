# Prepare Review-Only Materials Task Specification

> **Worked example:** Automation levels, tool names, data structures, and operating limits in this specification are proposed design defaults. Preparation always requires the student's explicit request.

## Basic Information

- **Task ID:** T6
- **Task name:** Prepare Review-Only Materials
- **Task type:** Act
- **Task owner:** Career Opportunity Prep Agent; the student reviews, edits, and approves any final materials.
- **Automation level (proposed):** L2.

## 1. Task Description

For one opportunity and an explicit student request, use one fixed model-supported operation to prepare the requested type: a resume refinement/tailoring draft that preserves the original, a tailored cover-letter draft, or interview practice flip cards with tailored questions and answer themes. The request determines one deliverable type before the model call. Use a predetermined prompt, produce an editable draft or structured card data, and check every factual claim against the posting and resume/confirmed student evidence. A recommendation alone does not start preparation.

Label every output "DRAFT TEMPLATE — STUDENT REVIEW REQUIRED." Preserve the uploaded resume as an immutable original and version each tailored draft separately. Clearly separate supported facts from prompts such as "STUDENT TO COMPLETE: add a verified example" and "UNKNOWN: posting does not state a deadline." Cover letters cannot invent enthusiasm, achievements, contacts, or employer facts. Flip cards show a question on the front and evidence-grounded answer themes or a student-completion prompt on reveal; they are practice aids, not rehearsed personal claims supplied by the model.

Do not fabricate qualifications, convert coursework into employment experience, write unsupported achievements, revise final application files, or describe the output as approved. This task provides preparation support only. The model cannot browse, choose tools, conduct new searches, contact employers, or submit applications. H3 handles review and approval. The run may finish with drafts awaiting review; finishing T6 or T7 does not constitute approval.

## 2. Inputs

### Input 1

- **Input name:** Student preparation request
- **Contents and format:** Explicit student instruction tied to one opportunity ID, naming resume refinement/tailoring, cover-letter drafting, or interview flip cards and the intended scope. Include request reference, time, resume version, and posting version. A model recommendation alone is not a valid request.
- **Source:** The student, received through T1: Retrieve Student Context and passed with T5: Recommend Next Actions.

### Input 2

- **Input name:** Validated opportunity record
- **Contents and format:** Employer, role, source link, saved posting evidence, requirements, location, dates, deadline, compensation when stated, and validation status. Preserve unavailable facts as unknown.
- **Source:** T3: Validate Opportunities for both discovery and the single revalidated target in a targeted update.

### Input 3

- **Input name:** Verified student context
- **Contents and format:** Original uploaded resume and its source-cited passages, confirmed corrections, and relevant education, experience, skills, constraints, and preferences with references and verification status. Any new clarification remains visibly student-supplied unless confirmed.
- **Source:** T1: Retrieve Student Context.

### Input 4

- **Input name:** Assessment and recommendation
- **Contents and format:** T4's completed evidence-backed fit and readiness assessment and T5's checked Next-action recommendation, with the explained fit score or provisional range or insufficient-evidence result, criterion-level matches, gaps, unknowns, separate eligibility/readiness status, requested preparation scope, and evidence references. The score alone cannot support a draft claim or override an unknown.
- **Source:** T4: Assess Opportunity Fit and T5: Recommend Next Actions.

- **If a required input is missing or invalid:** Skip preparation when no explicit request exists. When a request lacks a readable resume, posting, confirmed claim, or artifact scope, record the exact question in Preparation handoff and stop affected preparation while awaiting the student. An interview card may carry an explicit student-completion prompt for a missing example, but no unsupported answer may be presented as their experience. Do not produce a final-looking document to conceal a gap.

## 3. Outputs

### Output 1

- **Output name:** Review-only draft
- **Contents and format:** One editable, versioned resume-tailoring draft or cover-letter draft, or structured interview flip cards rendered with accessible front/reveal controls. Include required draft label, run/opportunity/draft IDs and versions, request and source-resume references, supported claims with resume/posting citations, visible student-completion prompts, unknowns, and a review checklist. A resume draft highlights additions/deletions without overwriting the original; a cover letter is tailored to the verified role; each card has a job-specific question and a separate reveal side with evidence-grounded answer themes or a prompt to supply a real example. The student verifies accuracy and decides final wording.
- **Next task or recipient:** H3: Student Reviews and Approves Final Materials, and T7: Record and Present Results for permitted storage and presentation.
- **Complete when:** The requested artifact is within scope, supported claims are traceable, placeholders and unknowns are visible, the original resume is preserved, flip-card reveal content is distinct from its front, and the draft is awaiting student review. Completion does not imply H3 approval.

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
- **Role in this task:** Produce the one requested artifact in a fixed prompt-and-check sequence, then format an editable draft or accessible flip-card data. Return it to T7 for versioned persistence. No original resume or final application file is changed and no artifact is sent externally.
- **Task timeout:** 90 seconds total for one opportunity, including the model request and checks.
- **Maximum retries:** 0.
- **Retry only when:** Not applicable.
- **On timeout, exhausted retries, or an error that cannot be retried:** Mark Preparation handoff unresolved, record the failed operation and needed correction, and send it to the student through T7. Mark the run incomplete because of an operational error. T7 saves available results and any remaining selected work as not processed. An incomplete or invalid draft cannot be labeled review-ready or routed onward as successful; distinguish this technical failure from preparation blocked solely on a recorded human input.
