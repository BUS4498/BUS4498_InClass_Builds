# Draft Reply Task Specification

## Basic Information

- **Task ID:** T4
- **Task name:** Draft Reply
- **Task type:** Reason
- **Automation level:** L2 — one bounded drafting operation using the model selected during the build, with student revision requests.
- **Task owner:** Local workflow controller; student owns final wording.

## 1. Task Description

Use the chosen drafting model to propose a concise reply to the user-selected message using up to three plain-text messages ending at the selected message (at most 4,000 characters each) and either the user's short intended response or an explicit **Acknowledgment only** choice. The user sets tone with a five-position slider: Professional, Polished, Balanced (default), Friendly, or Warm and chooses **Generate reply** after reviewing the bounded thread. Preserve the actual topic and tone. Do not invent a date, commitment, credential, attachment, or claim about the user. If essential information is missing, return a specific structured question and a marked placeholder for H2. At most three drafting attempts, including requested redrafts, are allowed per reply run; an existing draft remains editable afterward. Generate another reply reopens intent/tone controls with the saved thread snapshot; it does not retrieve newer thread messages or reset the attempt budget. Open pending replies can resume an unfinished saved run. The model cannot send mail, select a recipient, or invoke Gmail tools.

## 2. Inputs

### Input 1

- **Input name:** Selected thread context
- **Contents and format:** Connected account, selected Gmail message/thread IDs, validated reply metadata, up to three bounded message texts ending at the selected message, exact text-preview version, and the user's **Generate reply** action for that version.
- **Source:** T1

### Input 2

- **Input name:** User reply intent
- **Contents and format:** Required intended answer (at most 1,500 characters) or mutually exclusive acknowledgment-only choice; selected tone from the Professional-to-Warm slider. This input grants no authority to send.
- **Source:** User

- **If a required input is missing or invalid:** Ask the user for a short intended answer or acknowledgment-only choice, ask about any other essential missing fact, or show a retrieval error; produce no sendable draft. If the thread-text preview was not shown or changed after the Generate action, make no drafting-model call.

## 3. Outputs

### Output 1

- **Output name:** Review-only draft
- **Contents and format:** Editable body text, structured missing-fact questions and marked placeholders, selected thread ID, draft revision ID, and draft attempt count. Marked Draft; never treated as approved.
- **Next task or recipient:** H2
- **Complete when:** A draft grounded in the selected context or an explicit question/error is visible to the student.

## 4. Planned Tools

### Tool 1

- **Tool name:** `draft_student_reply`
- **Input:** Selected thread context and user reply intent
- **Output:** Review-only draft
- **Implementation Route:** Chosen drafting model through the local backend; verify its callable API and output contract in the Build Agent tool plan.
- **Integration approach:** Direct integration
- **Role in this task:** Produces reply text only; no tool calling or Gmail authority.
- **Task timeout:** 30 seconds per draft attempt.
- **Maximum retries:** 1 automatic retry for transient failure; all attempts, including requested redrafts, count toward three drafting-model calls per reply run.
- **Retry only when:** No draft was returned and the provider reports a transient failure; repeat the same bounded inputs once if the three-call budget remains.
- **On timeout, exhausted retries, or an error that cannot be retried:** Show drafting failure or budget exhaustion. Preserve any existing draft and saved run. A subsequent attempt must use the redraft route when an attempt has already been made and the budget remains; otherwise show exhaustion and keep the existing draft editable.
