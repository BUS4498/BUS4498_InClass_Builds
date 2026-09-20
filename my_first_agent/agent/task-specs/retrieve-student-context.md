# Retrieve Student Context Task Specification

> **Worked example:** Automation levels, tool names, data structures, and operating limits in this specification are proposed design defaults. The task ID, name, scope, and handoffs follow the existing workflow.

## Basic Information

- **Task ID:** T1
- **Task name:** Retrieve Student Context
- **Task type:** Retrieve
- **Task owner:** Internship Application Prep Agent; the student owns and verifies their information.
- **Automation level (proposed):** L1.

## 1. Task Description

Load the student-approved profile, preferences, constraints, opportunity collection, and any new student response using a fixed retrieval and completeness check. Preserve each fact's source and verification status. Do not infer qualifications or silently replace verified context with a conflicting response.

Identify the trigger as discovery or targeted update. Discovery proceeds to T2: Search Internship Sources only when the context needed to construct bounded searches is available. A targeted update proceeds directly to T4: Assess Opportunity Fit for the identified tracked opportunity, with zero market searches. An empty collection is valid for a first discovery run; a missing or unreadable collection is not an empty collection. Missing optional information remains unknown.

## 2. Inputs

### Input 1

- **Input name:** Run request
- **Contents and format:** Structured record containing a run ID, trigger type, request time, student-selected discovery request or reference to a previously approved daily schedule, and any requested preparation. A targeted update also includes one tracked opportunity ID and the student's new response or preparation request.
- **Source:** The student or the student's previously approved daily schedule.

### Input 2

- **Input name:** Student context records
- **Contents and format:** Local documents or structured records containing documented education, experience, skills, work authorization, availability, location constraints, and career preferences, with source references and verification status. Distinguish required search constraints from optional preferences and facts not yet supplied.
- **Source:** Student-provided and student-verified profile and preference records.

### Input 3

- **Input name:** Tracked opportunity collection
- **Contents and format:** Local collection containing opportunity IDs, employer and role, source links, saved posting evidence, previous assessments, recommendations, student decisions, unresolved questions, and record versions. A valid collection may contain no opportunities.
- **Source:** The existing local collection, including records previously checked by T7: Record and Present Results.

- **If a required input is missing or invalid:** Return the specific missing, unreadable, stale, or conflicting item to H1: Request Student Clarification. A targeted update without an identifiable tracked opportunity or usable saved posting evidence is blocked. End the active run as awaiting student; do not search, guess, or change records.

## 3. Outputs

### Output 1

- **Output name:** Verified student context
- **Contents and format:** Source-labeled profile, preferences, and constraints, with explicit unknowns and verification status. Include the run ID and the trigger and preparation scope from Run request.
- **Next task or recipient:** T2: Search Internship Sources and T3: Validate Opportunities for discovery; T4: Assess Opportunity Fit for both trigger types. T6: Prepare Review-Only Materials receives relevant facts only if preparation was explicitly requested.
- **Complete when:** Required context is readable and verified, relevant contradictions have been resolved, and missing optional values remain visibly unknown.

### Output 2

- **Output name:** Opportunity history
- **Contents and format:** Snapshot of the collection and its record versions for duplicate checks and later permitted updates. For a targeted update, identify the single target and package its saved employer, role, source link, posting evidence, requirements, location, dates, deadline, compensation when stated, and validation status as the Validated opportunity record required by T4. Include any Student clarification as a separately labeled input; a new response does not silently become a verified profile fact.
- **Next task or recipient:** T3: Validate Opportunities, T4: Assess Opportunity Fit, and T7: Record and Present Results.
- **Complete when:** Records can be traced to their stored versions and the target's evidence is usable, or a valid empty collection is explicitly identified for discovery.

### Output 3

- **Output name:** Context clarification request
- **Contents and format:** Exception record containing run ID, status, affected input, exact missing or conflicting information, relevant source references, and a specific question or access correction.
- **Next task or recipient:** H1: Request Student Clarification.
- **Complete when:** The student can identify what to supply or correct and the run is marked awaiting student.

## 4. Planned Tools

### Tool 1

- **Tool name:** retrieve_student_context
- **Input:** Run request; Student context records; Tracked opportunity collection.
- **Output:** Verified student context; Opportunity history; Context clarification request when blocked.
- **Implementation Route:** File operations to read the supplied local artifacts, followed by functions/scripts for fixed presence, format, identity, and version checks.
- **Integration approach:** Direct integration.
- **Role in this task:** Retrieve and package existing evidence and apply fixed routing checks. The tool does not generate student facts, search external sources, or write profile or collection changes.
- **Task timeout:** 30 seconds total, including all reads and checks.
- **Maximum retries:** 0.
- **Retry only when:** Not applicable.
- **On timeout, exhausted retries, or an error that cannot be retried:** Record the failed input or check, elapsed time, and failure category in Context clarification request; send it to H1: Request Student Clarification and end the run as awaiting student. A corrected student response starts a new run.
