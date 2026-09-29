# Retrieve Selected Inbox Batch Task Specification

## Basic Information

- **Task ID:** T1
- **Task name:** Retrieve Selected Inbox Batch
- **Task type:** Retrieve
- **Automation level:** L1 — bounded API retrieval under controller rules.
- **Task owner:** Local workflow controller

## 1. Task Description

On the user's inbox-opening action, list only the 15 newest `INBOX` message IDs in Gmail's reverse chronological order, then retrieve metadata with stable Gmail message/thread IDs, sender, subject, and timestamp, excluding the body-derived snippet from that metadata request. Do not offer an older-page cursor or separate inbox-preview panel. Retrieve bounded plain text for those IDs and pass it to the chosen sorting model without a second confirmation. On a reply action, validate that the user selected an incoming inbox message from the current retrieved batch, then retrieve up to three chronological thread messages ending at the selected message. Do not include later messages in that thread. A clear category or successful Gmail label is not required to reply. Extract plain-text MIME parts, skipping attachment parts; do not separately download attachments or use HTML as model input. Avoid duplicate message IDs within a run.

Connection alone does not trigger this task. Its first entry point is **Open & sort live inbox**. Its reply entry point is **Reply** on an email from that retrieved batch, revealed through a category bar. The reply entry point retrieves only the selected thread, not another inbox batch. Before the inbox has been retrieved, there is no email available for a new reply; reopening a previously saved draft is a separate resume action.

Sorting excerpts are capped at 2,000 characters per message and snippets at 180 characters. Reply context is capped at 4,000 characters per message (12,000 across three messages). Thread metadata may be read to locate the selected message, but only that bounded context goes to drafting.

For the reply path, show and version the exact bounded thread text and name the chosen drafting provider before the user chooses **Generate reply**. That action authorizes the drafting-model request. The inbox action itself initiates sorting.

## 2. Inputs

### Input 1

- **Input name:** Authorized Gmail connection and trigger
- **Contents and format:** Connected account ID, inbox-opening or reply action, run ID, the at most 15 unique newest inbox message IDs for sorting, or one selected message ID for a reply. Drafting-model processing requires the later **Generate reply** action after the exact thread text is shown.
- **Source:** H0 and student browser action

- **If a required input is missing or invalid:** Stop on invalid selection or authentication, show a reconnect or selection action, and send the failure to T6. Exclude individual failed metadata records from sorting eligibility. For selected-text failures, preserve fetch status; missing sorting text becomes Needs review and unusable reply context blocks drafting.

## 3. Outputs

### Output 1

- **Output name:** Retrieved message set
- **Contents and format:** The one-window metadata set contains at most 15 IDs, sender, subject, and date, but no snippet, body text, or older-page cursor. For sorting, message records contain IDs, thread IDs, sender, subject, date, optional Gmail snippet (180 characters), plain text (2,000 characters), and fetch status; an empty inbox is valid. Reply output separately contains up to three messages ending at the selected message, each with at most 4,000 plain-text characters, parsed reply headers, fetch status, and the preview version.
- **Next task or recipient:** T2 after bounded inbox retrieval; user text review and **Generate reply** action after selected-thread retrieval; T4 after that action; T6 for empty/error outcome.
- **Complete when:** The newest metadata window and bounded sorting text are known, or the selected reply thread's exact bounded text preview and fetch outcomes are known and shown in the app.

## 4. Planned Tools

### Tool 1

- **Tool name:** `retrieve_gmail_messages`
- **Input:** Authorized Gmail connection and trigger
- **Output:** Retrieved message set
- **Implementation Route:** Gmail messages/threads API via local backend
- **Integration approach:** Direct integration
- **Role in this task:** Lists inbox metadata and retrieves bounded text only for the newest displayed IDs or selected reply thread; it normalizes safe text for downstream tasks.
- **Task timeout:** 30 seconds shared by the inbox ID list and its metadata reads; selected sorting-message reads have their own 30-second deadlines. The sort-processing deadline starts before this preparation, but does not interrupt its sequential reads; T2 checks the remaining budget before processing. Reply thread metadata and each selected full-message read have separate 30-second deadlines, so the complete thread action can take longer than 30 seconds.
- **Maximum retries:** 1.
- **Retry only when:** A read request fails transiently; retry after 2 seconds using the same newest-message window or selected IDs and limits, within the overall sort budget.
- **On timeout, exhausted retries, or an error that cannot be retried:** Record the failed read and do not fabricate its contents. Continue with eligible metadata records; route missing sorting text to H1/Needs review and T6. Block T4 if the selected reply excerpt is empty or any selected thread fetch failed.
