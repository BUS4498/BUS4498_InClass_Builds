# Retrieve Student Context Task Specification

> **Worked example:** Automation levels, tool names, data structures, and operating limits in this specification are proposed design defaults. The task ID, name, scope, and handoffs follow the existing workflow.

## Basic Information

- **Task ID:** T1
- **Task name:** Retrieve Student Context
- **Task type:** Retrieve
- **Task owner:** Career Opportunity Prep Agent; the student owns and verifies their information.
- **Automation level (proposed):** L1.

## 1. Task Description

Accept and preserve the student's original resume, extract readable text and literal source-cited education, experience, and skill passages for the student to confirm or correct, and load selected role interests, timeframe, role types (internships, entry-level jobs, or both), preferences, constraints, local job spreadsheet, and any new response. Use a fixed retrieval and completeness check. Record resume version and confirmation status. Do not infer qualifications from absent resume text or silently replace confirmed context with a conflicting response. A scan with unreadable text requires a readable replacement or approved text extraction route; it is not an empty resume.

Identify the trigger as manual discovery, approved daily/weekly scheduled discovery, or targeted update. Discovery proceeds to T2: Search Career Sources only when the resume, student-confirmed search scope, and required local state are available. A schedule uses the last approved scope version and a confirmed recipient; a scope change pauses the scheduled run for confirmation. A targeted update proceeds to T3: Validate Opportunities for exactly one identified tracked opportunity or saved pending candidate, and only then to T4 when validation succeeds, with zero market searches. An empty spreadsheet is valid for a first discovery run; a missing or unreadable existing spreadsheet is not empty state. Unknown eligibility, authorization, availability, or geographic preference remains unknown unless explicitly confirmed.

## 2. Inputs

### Input 1

- **Input name:** Run request
- **Contents and format:** Structured record containing run ID, manual or scheduled trigger, request time, resume version, student-selected role interests, timeframe and role types, search preferences and hard constraints, or a reference to the last approved scope version for a daily/weekly schedule. Include the student-saved schedule configuration reference and version (cadence, local time, timezone, weekly day if relevant, confirmed recipient, enabled state, and sender integration reference), plus any requested preparation. A targeted update includes one tracked opportunity ID or saved pending-candidate ID and the student's response or opportunity-scoped preparation request. A pending-candidate response is validated before it can create a tracked opportunity.
- **Source:** The student or the student's previously approved daily schedule.

### Input 2

- **Input name:** Student context records
- **Contents and format:** Original uploaded resume (PDF, DOCX, or plain text when readable), its extracted passages and version, plus student-confirmed corrections and structured records for role interests, timeframe, work authorization, availability, location constraints, and preferences, each with source references and verification status. Distinguish resume evidence from later student-supplied facts and optional unknowns. Store the private original locally; do not publish it to the repository or send it in a digest.
- **Source:** Student upload and student-confirmed profile and preference records.

### Input 3

- **Input name:** Tracked opportunity collection
- **Contents and format:** Local job opportunity spreadsheet and linked evidence records containing every screened opportunity's stable ID, source links, disposition, prior assessments and recommendations, student decisions, unresolved questions, first/last seen times, and versions. A valid first-run spreadsheet may contain no rows. Load linked pending-handoff and pending-candidate records when referenced; an unvalidated candidate stays separate from scored records.
- **Source:** The existing local spreadsheet and records previously checked by T7: Record and Present Results.

- **If a required input is missing or invalid:** Return the specific missing, unreadable, stale, or conflicting resume, scope, or state item to H1: Request Student Clarification. A targeted update without an identifiable tracked opportunity or saved pending candidate and usable evidence is blocked. End as awaiting student for missing student input, or incomplete because of an operational error for failed reads/checks/saves; do not search, guess, or change spreadsheet rows. Optional student facts may remain unknown and should not block all discovery.

## 3. Outputs

### Output 1

- **Output name:** Verified student context
- **Contents and format:** Resume version and source-cited confirmed passages, selected timeframe and role types, preferences and constraints, explicit unknowns and verification status; run ID, trigger, approved scope version, student-saved schedule/recipient configuration reference when scheduled, and preparation request. Distinguish a literal resume passage from a student-confirmed update; never include the recipient address in a public search query.
- **Next task or recipient:** T2: Search Career Sources for discovery; T3: Validate Opportunities and, after successful validation, T4 for both trigger types. T6 receives relevant facts only on an explicit preparation request.
- **Complete when:** The resume and chosen search scope are readable and confirmed for the run, relevant contradictions are resolved, and optional values remain visibly unknown.

### Output 2

- **Output name:** Opportunity history
- **Contents and format:** Snapshot of spreadsheet rows, linked evidence, and record versions for duplicate checks and permitted updates. For a targeted update, identify the single tracked opportunity or saved pending candidate and package employer, role, links, posting evidence, requirements, location, dates, deadline, compensation when stated, prior validation status, and newly supplied evidence for T3. Include a Search run log marked not applicable with zero discovery searches and new candidates. T1 does not label the target revalidated; only T3 does. Include Student clarification separately; a new response does not silently become a resume claim.
- **Next task or recipient:** T3: Validate Opportunities, T4: Assess Opportunity Fit after validation, and T7: Record and Present Results. For a targeted update, pass the packaged Candidate opportunity evidence and not-applicable Search run log to T3.
- **Complete when:** Records can be traced to their stored versions and the target's evidence is usable, or a valid empty first-run spreadsheet is explicitly identified for discovery.

### Output 3

- **Output name:** Context clarification request
- **Contents and format:** Exception record containing run ID, status, affected input, exact missing or conflicting information, relevant source references, and a specific question or access correction.
- **Next task or recipient:** H1: Request Student Clarification.
- **Complete when:** The student can identify what to supply or correct and the run outcome distinguishes awaiting student from an operational error; H1 confirms whether the handoff was saved.

## 4. Planned Tools

### Tool 1

- **Tool name:** retrieve_student_context
- **Input:** Run request; Student context records; Tracked opportunity collection.
- **Output:** Verified student context; Opportunity history; Context clarification request when blocked.
- **Implementation Route:** File operations to read the supplied local artifacts, followed by functions/scripts for fixed presence, format, identity, and version checks.
- **Integration approach:** Direct integration.
- **Role in this task:** Extract readable resume text without invented claims, retrieve and package confirmed evidence, read the local spreadsheet, and apply fixed routing checks. It does not choose student preferences, search externally, email anyone, or write resume/spreadsheet changes.
- **Task timeout:** 30 seconds total, including all reads and checks.
- **Maximum retries:** 0.
- **Retry only when:** Not applicable.
- **On timeout, exhausted retries, or an error that cannot be retried:** Record the failed input or check, elapsed time, and failure category in Context clarification request; send it to H1: Request Student Clarification and end the run incomplete because of an operational error, while keeping any human next step visible. A corrected student response starts a new run.

### Tool 2

- **Tool name:** save_student_setup
- **Input:** Student-uploaded original resume; student-confirmed extracted passages/corrections; selected role interests, timeframe, and role types; preferences and constraints; explicit schedule enable/disable, cadence, local time, timezone, weekly day when relevant, confirmed recipient, and sender integration reference when configured.
- **Output:** Versioned local private resume reference, confirmed search-scope record, and optional schedule/recipient configuration reference with read-back status. Return an exact validation question instead of saving an incomplete schedule.
- **Implementation Route:** Local file operations and deterministic validation from a student-facing upload/setup control. Preserve each original resume version; keep private resume and recipient configuration outside published repository paths. Confirm writes by read-back and reject conflicting versions.
- **Integration approach:** Direct integration. A student action invokes this setup tool before a discovery run or when changing scope/schedule; T1's retrieval tool then reads the saved references.
- **Role in this task:** Persist only student-supplied or student-confirmed setup values. It cannot infer a missing role interest, timeframe, role type, recipient, or email consent; it cannot start a search or send a digest. Changing the approved scope or recipient pauses future scheduled runs until the student confirms the updated configuration.
- **Task timeout:** 30 seconds for one upload/configuration save and read-back; resume text extraction is bounded by the same operation and unreadable scans return an explicit correction need.
- **Maximum retries:** 0.
- **Retry only when:** Not applicable. An uncertain save is inspected by read-back before any manually repeated submission.
- **On timeout, exhausted retries, or an error that cannot be retried:** Preserve the previous confirmed resume/scope/schedule versions, report the affected field and save status, and do not start a scheduled or manual search from unconfirmed setup.
