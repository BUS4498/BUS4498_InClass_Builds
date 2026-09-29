# Apply Student Category Label Task Specification

## Basic Information

- **Task ID:** T3
- **Task name:** Apply Student Category Label
- **Task type:** Act
- **Automation level:** L1 — deterministic Gmail label change after a valid category decision.
- **Task owner:** Local workflow controller

## 1. Task Description

Read current message labels, ensure the selected app-owned label exists, then apply it to the exact Gmail message ID. Automatic sorting must not start new label writes after cancellation or a run limit; reconcile writes already in flight. A later explicit H1 selection starts its own bounded operation even if the original run has stopped. Remove only a previous app-owned `Student/` category label on that message. Never alter Gmail system or unrelated user labels. Ownership requires a label ID in the local app registry: a preexisting same-name Student/ label is not automatically owned. A same-name collision or a renamed/deleted registered label blocks the operation for review. If the initial read already confirms the desired state, return verified without a write; otherwise re-read after mutation. A saved override preserved by T2 does not invoke this task and must not be presented as newly verified.

## 2. Inputs

### Input 1

- **Input name:** Authorized category decision
- **Contents and format:** Connected account ID, message ID, one valid category ID, decision origin, and current override revision.
- **Source:** T2 or H1

- **If a required input is missing or invalid:** Make no Gmail change; send the item to H1 or T6 with an error.

## 3. Outputs

### Output 1

- **Output name:** Label operation result
- **Contents and format:** Message ID, requested category, observed app-owned label, verified/failed/unknown status, and error details.
- **Next task or recipient:** T6; H1 if the student must resolve a conflict.
- **Complete when:** A Gmail read confirms the intended category label with no conflicting app-owned category label, or a failed/unknown outcome is recorded. Sample mode records simulated success without Gmail access.

## 4. Planned Tools

### Tool 1

- **Tool name:** `apply_student_label`
- **Input:** Authorized category decision
- **Output:** Label operation result
- **Implementation Route:** Gmail labels and messages.modify API via local backend
- **Integration approach:** Direct integration
- **Role in this task:** Changes only the app-owned category labels for the exact message and verifies the state.
- **Task timeout:** 15 seconds shared across label reads, creation, mutation, retry, and verification for one operation.
- **Maximum retries:** 1.
- **Retry only when:** After a transient failure, first re-read current labels; retry only if the desired state is absent, using the same message ID and label IDs after 2 seconds, if the operation deadline allows.
- **On timeout, exhausted retries, or an error that cannot be retried:** Record failed or unknown outcome; do not claim the mail was sorted.
