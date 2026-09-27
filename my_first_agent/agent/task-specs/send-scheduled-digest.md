# Send Scheduled Digest Task Specification

> **Worked example:** Automation levels, tool names, data structures, and operating limits in this specification are proposed design defaults. Only a student-configured scheduled discovery run may email its digest to that student's confirmed address.

## Basic Information

- **Task ID:** T8
- **Task name:** Send Scheduled Digest
- **Task type:** Act
- **Task owner:** Career Opportunity Prep Agent; the student owns the schedule and recipient.
- **Automation level (proposed):** L1.

## 1. Task Description

After T7 verifies the local spreadsheet write for a daily or weekly scheduled discovery run, render a well-formatted digest from the approved email template and submit one message to the student's confirmed address. The digest shows the ranked scored group, the needs-student-information group, checked posting links, next steps, shortfalls, and source coverage. It includes no full resume text, private resume attachment, unreviewed draft, or employer address. A manual run, targeted update, disabled schedule, missing confirmed recipient, or failed T7 read-back cannot send.

The schedule records daily or weekly cadence, local send time, timezone, weekly day when applicable, recipient reference, approved search-scope version, and enable/disable state. A scope or recipient change requires student confirmation before the next scheduled send. Email submission is distinct from confirmed delivery. Use run ID and digest ID for idempotency; uncertain submission is inspected before any manual replay. No email goes to an employer and no application is submitted.

## 2. Inputs

### Input 1

- **Input name:** Verified scheduled run summary
- **Contents and format:** T7's run ID, scheduled trigger and schedule ID, verified spreadsheet read-back, two result groups, checked links, shortfalls, source coverage, and digest-safe next steps. No full resume text or review-only draft body.
- **Source:** T7: Record and Present Results.

### Input 2

- **Input name:** Student schedule and recipient configuration
- **Contents and format:** Student-confirmed email recipient, daily or weekly cadence, local time, timezone, weekly day if needed, enabled state, approved search-scope version, sender integration reference, and configuration version. The email address is private runtime configuration, not repository content.
- **Source:** Student configuration loaded by T1: Retrieve Student Context and the scheduler.

### Input 3

- **Input name:** Digest template
- **Contents and format:** Approved formatted HTML and plain-text fallback structure with placeholders for the two result groups, links, counts, source coverage, and status; safe escaping and accessibility requirements. No personal resume data embedded in the template.
- **Source:** `my_first_agent/templates/job-opportunity-digest.html` and its plain-text renderer, prepared and reviewed during the template stage.

- **If a required input is missing or invalid:** Do not send. Record the exact missing configuration, failed T7 proof, mismatched scope version, invalid recipient, or template/render error. Keep the search/spreadsheet outcome intact and show notification status failed or not attempted with a student-owned correction step.

## 3. Outputs

### Output 1

- **Output name:** Scheduled digest message
- **Contents and format:** One addressed HTML email with plain-text alternative, subject identifying search timeframe and run date, up to five scored summaries, up to three needs-information summaries, source coverage and shortfalls, checked posting links, clear score evidence links, and a route back to the local application for details. Include a visible no-results message when both groups are empty after a successful bounded search. Exclude resume text and draft attachments.
- **Next task or recipient:** The student's configured email address through the approved sender integration.
- **Complete when:** The message is rendered from verified T7 data, recipient and scope version match approved configuration, and exactly one submission attempt with the run/digest ID is recorded.

### Output 2

- **Output name:** Digest delivery status
- **Contents and format:** Run ID, digest ID, schedule/configuration version, intended recipient reference, submission time, provider message ID when available, and status not attempted, submitted, failed, or unknown. A submitted status is not confirmed inbox delivery. Preserve error category and next step without exposing credentials.
- **Next task or recipient:** The student and local run/digest record; T1 may read this on a later run to prevent duplicates.
- **Complete when:** The status accurately reflects provider evidence and a repeated trigger cannot silently submit the same digest twice.

## 4. Planned Tools

### Tool 1

- **Tool name:** send_scheduled_digest
- **Input:** Verified scheduled run summary; Student schedule and recipient configuration; Digest template.
- **Output:** Scheduled digest message; Digest delivery status.
- **Implementation Route:** Deterministic HTML/plain-text rendering, recipient/scope checks, and one approved email-provider API or connector call from the runtime, with local idempotency and status recording.
- **Integration approach:** Direct integration after explicit student schedule/recipient setup and a bounded connection test.
- **Role in this task:** Send one digest to the configured student recipient after T7 read-back. The tool cannot search, modify the spreadsheet or resume, send to employers, attach drafts, or submit applications.
- **Task timeout:** 30 seconds total for rendering, one submission attempt, and status recording.
- **Maximum retries:** 0.
- **Retry only when:** Not applicable. An uncertain provider outcome requires read-only status inspection before a student-authorized manual retry with the same digest ID.
- **On timeout, exhausted retries, or an error that cannot be retried:** Record failed or unknown delivery status with provider evidence and affected digest ID. Do not report an inbox delivery or send a duplicate. The verified search/spreadsheet result remains available locally; show the student the notification failure and next step.
