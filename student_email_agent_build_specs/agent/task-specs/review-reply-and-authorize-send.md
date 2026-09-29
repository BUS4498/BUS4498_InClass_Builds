# Review Reply and Authorize Send Task Specification

## Basic Information

- **Task ID:** H2
- **Task name:** Review Reply and Authorize Send
- **Task type:** Verify
- **Automation level:** L0 — student edits and explicitly authorizes the exact reply.
- **Task owner:** Student

## 1. Task Description

Display the selected thread reference, exact recipient address, fixed subject, editable generated body (at most 8,000 characters), and any unresolved missing-fact questions or marked placeholders. The generated draft is saved automatically. The student can Save edits, Generate another reply within the three-call budget, Keep pending, or Discard. Save edits and Keep pending persist changes without authorizing a send. Changed body or recipient must be saved before sending; an unchanged eligible generated draft does not need an extra save click. Redrafting returns to T4 using the saved thread preview and new intent/tone choices. The interface has no separate **Write manually** option. If Reply-To has multiple valid addresses, the user must choose exactly one; invalid or self-recipient addresses block sending and a `no-reply` recipient prompts a warning. An unresolved placeholder blocks sending until resolved in the text; where missing questions were returned, the student also confirms they answered them and removed placeholders, then saves. A separate **Send this reply** action opens a final confirmation containing the exact recipient and final body. Cancel returns to review without authorization. Confirm and send once creates a one-use authorization tied to the saved account, thread, revision, body hash, and recipient; it expires after five minutes. A no-reply recipient requires acknowledgment in that dialog. Saved changes clear prior authorization, and mismatched account/thread/revision data blocks use. T5 creates its operation ID only when sending starts. Sending is never implied by approving a model draft.

## 2. Inputs

### Input 1

- **Input name:** Draft and reply metadata
- **Contents and format:** T4 generated draft with user edits, selected account/thread, parsed Reply-To or From address choices, selected single recipient, subject, unresolved-question status, and revision ID.
- **Source:** T1, T4, and user edits/recipient choice

- **If a required input is missing or invalid:** Disable send and display the missing item. Require one valid nonself recipient and resolution of marked placeholders before a new confirmation.

## 3. Outputs

### Output 1

- **Output name:** Student send authorization or pending outcome
- **Contents and format:** Exact account, one validated recipient and choice revision, subject, body hash/revision, thread ID, one-use authorization timestamp, or keep/discard status.
- **Next task or recipient:** T4 for a requested redraft; H2 for editing or cancelled confirmation; T5 only for Confirm and send once; T6 for saved pending/discard outcomes.
- **Complete when:** The final confirmation records an authorized snapshot, or the saved/pending/discard state is visible. Merely opening the dialog does not authorize sending.

## 4. Planned Tools

### Tool 1

- **Tool name:** `record_send_authorization`
- **Input:** Draft and reply metadata plus explicit confirmation
- **Output:** Student send authorization or pending outcome
- **Implementation Route:** Local UI and local state
- **Integration approach:** Direct integration
- **Role in this task:** Validates the exact displayed send snapshot and records a one-use decision; it never calls Gmail.
- **Task timeout:** No forced deadline; authorizations expire after 5 minutes without send.
- **Maximum retries:** Not applicable — manual task.
- **Retry only when:** Not applicable.
- **On timeout, exhausted retries, or an error that cannot be retried:** Keep the draft pending and require a fresh confirmation.
