# T3: Build Study Sprint

## Basic information

- **Task ID:** T3
- **Task owner:** Local application controller
- **Automation level:** L1; fixed method and time rules.

## 1. Task description

Create one short session for T2's top topic, or for another queued topic explicitly chosen by the student in H2. Validate that a chosen topic is still in the current queue. Apply the exam-format default method and exact time allocation in [study rules](../../docs/context/study-rules.md). If H2 sends an explicit adoption of T4's method, require a valid saved suggestion for the same context version and selected topic before applying it to this sprint. Present the selected topic, its priority evidence and whether the student overrode the top recommendation, the active and default methods, the method's source, the three timed steps, and a self-check prompt that asks the student to consult their own materials. Do not generate unsupported course answers.

## 2. Inputs

- **Ranked topic list:** T2 result and version.
- **Study context:** Exam format, exam date, available minutes, and any explicit student topic choice.
- **Student method adoption, when present:** H2's explicit choice of one allowed method from a valid saved T4 suggestion, with the selected topic ID and current context version. A missing, stale, or mismatched suggestion is not an adoption.

## 3. Outputs and handoff

- **Current sprint:** Selected topic ID, active method, exam-format default method, method source (`exam-format default` or `student-adopted model suggestion` with provider), goal/work/self-check minutes, priority reasons, current context version, sprint revision, and saved/read-back status. Show it to H2. A valid adoption creates a new sprint revision under the same context version; it does not rewrite topic inputs, ranking, or study progress.
- **Invalid or stale adoption:** Leave the prior saved sprint intact and return a specific message to H2 to review the current sprint and request a new comparison if desired.
- **No queued topics:** Display the empty or all-reviewed state and its next input action; no sprint is invented.
- **Complete when:** The sprint is displayed and, when one exists, its current result is saved and read back with the matching context version. A save failure stays visible as unsaved and makes the core run incomplete.

## 4. Planned tool

`compose_sprint` performs local arithmetic and formats fixed instructions. It validates any student adoption against the saved suggestion, context version, selected topic, and allowed method list before changing the sprint. `local_study_store` saves the current result. No model call, external content, or automatic retry occurs in this task.
