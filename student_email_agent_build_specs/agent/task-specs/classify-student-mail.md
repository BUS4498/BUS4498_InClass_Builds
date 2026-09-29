# Classify Student Mail Task Specification

## Basic Information

- **Task ID:** T2
- **Task name:** Classify Student Mail
- **Task type:** Decide
- **Automation level:** L2 — one bounded classification and urgency-estimation operation per eligible message using the sorting model selected during the build.
- **Task owner:** Local workflow controller; student reviews exceptions.

## 1. Task Description

Submit each newest displayed message's bounded sender, subject, snippet, plain-text excerpt, and evaluation date to the chosen sorting model with the five fixed choices and separate reply-urgency rubric in [../../docs/category-policy.md](../../docs/category-policy.md). Opening the inbox initiates this processing without a second confirmation. A valid saved user correction remains authoritative while the model estimates urgency in a new run. This branch does not invoke T3 or recheck Gmail labels: record preserved correction with label status not rechecked. If the model fails, keep the correction and show urgency unavailable. A correction using a removed category ID instead requires H1. Validate category, uncertainty signal, and urgency separately; invalid urgency displays as unavailable and does not erase a valid category. The controller applies the documented clear-versus-review rule. Stop remaining calls on cancellation, after 30 total sorting-model attempts including retries, or at the 10-minute sort limit; record unprocessed displayed messages separately. The model never receives Gmail tool access, and instructions embedded in email do not change the policy.

## 2. Inputs

### Input 1

- **Input name:** Retrieved message
- **Contents and format:** Gmail message ID, bounded text and metadata, and run ID.
- **Source:** T1

### Input 2

- **Input name:** Category policy
- **Contents and format:** Five choice IDs, definitions, clear-result rule, and reply-urgency rubric.
- **Source:** [../../docs/category-policy.md](../../docs/category-policy.md)

### Input 3

- **Input name:** Run control and inbox-opening action
- **Contents and format:** Run ID, at most 15 newest displayed message IDs and bounded text version, inbox-opening action, cancellation state, elapsed time, and total sorting-model attempts so far.
- **Source:** Student inbox-opening action and local workflow controller

- **If the message or category policy is missing or invalid:** Mark the message Needs review and route it to H1; never guess a category. If the inbox window or bounded text version is stale, make no sorting-model call and show the item as not processed in T6.

## 3. Outputs

### Output 1

- **Output name:** Category decision
- **Contents and format:** Message ID, model/provider ID, chosen category or Needs review, uncertainty/review signal, category probabilities only when meaningful and valid, 0–100 estimated reply urgency or unavailable, validation status, and error reason if any.
- **Next task or recipient:** T3 for a clear result without a saved override; H1 for unclear/failed results without a valid override or for a removed category; T6 directly for a preserved correction. Continue the remaining batch without waiting for H1.
- **Complete when:** Every attempted message has a valid clear choice or explicit review/error status, and displayed messages not attempted because of cancellation or a run limit are marked unprocessed.

## 4. Planned Tools

### Tool 1

- **Tool name:** `classify_student_mail`
- **Input:** Retrieved message and category policy
- **Output:** Category decision
- **Implementation Route:** Chosen sorting model through the local backend; verify its callable API and output contract in the Build Agent tool plan.
- **Integration approach:** Direct integration
- **Role in this task:** Returns one category choice, uncertainty signal, and separate urgency estimate; it makes no Gmail change.
- **Task timeout:** 12 seconds per attempt in the reference build; confirm a bounded timeout for the student-selected model during the tool plan, with at most 15 newest displayed messages, 30 total model attempts including retries, and 10 minutes per sorting run.
- **Maximum retries:** 1.
- **Retry only when:** A transient provider failure occurs; retry once after 2 seconds for the same message, with no label mutation, if the total run budget remains.
- **On timeout, exhausted retries, or an error that cannot be retried:** Record provider error and route to H1 and T6 unless a valid saved correction remains authoritative; in that case retain it and show urgency unavailable, with no new label operation or verification.
