# Review Category Choice Task Specification

## Basic Information

- **Task ID:** H1
- **Task name:** Review Category Choice
- **Task type:** Decide
- **Automation level:** L0 — student resolves or defers a category.
- **Task owner:** Student

## 1. Task Description

Show saved message details and the model decision or error. Accept changes only after that sorting run has stopped and the supplied decision version still matches. The student may select one of the five categories without another confirmation; the controller immediately invokes T3. Save a durable override only after verified live labeling or successful sample simulation. A failed or unknown label operation remains unresolved. Skip is available only for an unresolved item whose label operation has not started; Review later is available for unresolved category or label outcomes. Both leave Gmail labels unchanged. A deferred item persists with account ID, message ID, run ID, and decision version, and can be reopened through **Review pending categories** without reclassifying the batch. The same correction control is available for a clear model result. A verified correction is stored as an override and is not silently replaced in later runs. Those later runs preserve the category without a fresh Gmail label write or verification. A correction under a removed category ID stays stored but requires a new student choice before a new Gmail label write.

## 2. Inputs

### Input 1

- **Input name:** Message and category decision
- **Contents and format:** Account ID, message ID, run ID, decision version, saved message details, proposed category or error, and recorded app-owned label outcome. Saved review does not itself retrieve current Gmail label state. New Reply remains unavailable for a saved item outside the current retrieved inbox batch.
- **Source:** T1 and T2

- **If a required input is missing or invalid:** Leave labels untouched and show the item as unavailable.

## 3. Outputs

### Output 1

- **Output name:** Student category decision
- **Contents and format:** Account ID, message ID, decision version, selected category or skip/later, action timestamp, resulting label-operation status, and an override marker only after T3 succeeds.
- **Next task or recipient:** T3 for a selected category; T6 for skip/later.
- **Complete when:** The choice has been routed and its label outcome is recorded, or skip/later is saved. Pending items remain reachable after reopening; stale versions and attempts during active sorting are rejected.

## 4. Planned Tools

### Tool 1

- **Tool name:** `record_category_review`
- **Input:** Message and category decision plus student selection
- **Output:** Student category decision
- **Implementation Route:** Local UI and local state
- **Integration approach:** Direct integration
- **Role in this task:** Records only the student's choice; it does not apply a Gmail label itself.
- **Task timeout:** No forced deadline; the student may return later.
- **Maximum retries:** Not applicable — manual task.
- **Retry only when:** Not applicable.
- **On timeout, exhausted retries, or an error that cannot be retried:** Leave the message Needs review and show the save error.
