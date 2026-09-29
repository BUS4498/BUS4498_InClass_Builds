# Send Approved Reply Task Specification

## Basic Information

- **Task ID:** T5
- **Task name:** Send Approved Reply
- **Task type:** Act
- **Automation level:** L1 — deterministic Gmail send for one student-approved snapshot.
- **Task owner:** Local workflow controller

## 1. Task Description

Validate the one-use H2 authorization, connected account, exactly one valid nonself recipient and its choice revision, thread, resolved-placeholder status, and exact draft revision again on the backend. Build a Gmail MIME reply with threading headers and a unique outbound Message-ID, then call Gmail `messages.send` once. Consume the authorization before the call. Create the operation ID and persist sending state before the transport call, then record the response. Require a valid original Message-ID for live reply threading; do not add CC, BCC, or attachments. If the response is uncertain, inspect Gmail Sent for the outbound Message-ID and show the result; never automatically resend. A valid successful response containing a message ID and matching thread is sent evidence without a mandatory additional Sent lookup. A reconciliation match must have the exact outbound Message-ID, expected thread, and SENT label. A definite failure permits reopening the saved draft and a fresh H2 confirmation; an unknown result blocks resending and offers Check Gmail Sent again. On restart, unfinished sending operations become unknown. Sample sends are explicitly fictional and make no Gmail call.

## 2. Inputs

### Input 1

- **Input name:** One-use send authorization
- **Contents and format:** Account, exact single recipient and choice revision, subject, body hash/revision, thread ID, resolved-placeholder status, authorization ID and timestamp. T5 creates the send operation ID after validating and consuming the authorization.
- **Source:** H2

- **If a required input is missing, changed, expired, or invalid:** Block send and return to H2 for fresh review.

## 3. Outputs

### Output 1

- **Output name:** Send operation result
- **Contents and format:** Operation ID, Gmail message/thread ID when returned, unique outbound Message-ID, sent/failed/unknown status, and verification evidence.
- **Next task or recipient:** T6 and student
- **Complete when:** Gmail confirms the message or a Sent lookup verifies the exact outbound Message-ID; otherwise show unknown/failed.

## 4. Planned Tools

### Tool 1

- **Tool name:** `send_approved_gmail_reply`
- **Input:** One-use send authorization
- **Output:** Send operation result
- **Implementation Route:** Gmail messages.send and read-only Sent verification via local backend
- **Integration approach:** Direct integration
- **Role in this task:** Sends only the exact approved reply to the exact displayed recipient and reconciles uncertain outcomes.
- **Task timeout:** 30 seconds for the single send request; an uncertain response triggers a bounded Sent search and matching-message checks, each read capped at 20 seconds. A student-requested Check Gmail Sent again repeats only those reads.
- **Maximum retries:** 0 send retries.
- **Retry only when:** Not applicable; an unknown result requires student review after reconciliation.
- **On timeout, exhausted retries, or an error that cannot be retried:** Mark unknown or failed accurately; do not generate a second outbound message.
