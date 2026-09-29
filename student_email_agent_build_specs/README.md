# About the Agentic System

**Student Mail Assistant**

> **Problem to be solved:** Students receive personal, course, job, finance, and other messages in one inbox. Messages needing a reply are easy to overlook, and writing a suitable reply can take time. The assistant should give each of the newest displayed messages a useful student-focused category and an estimated reply urgency, and prepare a reply when requested, while the student remains responsible for the message they send.

### System Designer Name

BUS 4498 project specification

### System Name

Student Mail Assistant

### System Goal

**For** a student using one Gmail account, **improve** the student's ability to find and respond to relevant messages, **measured by** user agreement with the sorting model's proposed category and the share of requested drafts the student accepts after at most one edit, **moving from** a baseline measured in the first user-reviewed pilot **to** targets of at least 85% category agreement and 75% draft acceptance on later comparable batches, **without** sending a message without the student's explicit approval, changing Gmail's system categories, reading attachments by default, or treating message content as instructions to the agent. Category agreement counts matches among messages the student reviewed and for which the sorting model returned a valid category choice; skipped and provider-error messages are reported separately. Draft acceptance counts generated drafts authorized at final send confirmation after at most one saved body change, among generated-draft runs ending sent, discarded, failed, or unknown. Acceptance measures the student authorization, not delivery success. Pending runs and requests without a generated draft are reported separately. Record the denominator for each batch. The baseline is not known yet and must not be invented.

### Who Is Better Off When This Works?

The student can scan a small, organized set of mail and send a reply they have reviewed and can still edit.

## Scope and authority

The new-reply path is **Connect Gmail → Open & sort live inbox → click a category bar → Reply on an email → set intent and tone → Generate reply → review/edit → Send this reply → Confirm and send once**. Connecting establishes access; the student must click to retrieve the inbox before choosing an email for a new reply.

This is a **local app**: a browser dashboard, local workflow backend, and local state. Gmail and the models chosen during the Build Agent workflow may use online services. Each student's build serves that student and one Gmail account on their computer. **Open & sort live inbox** retrieves and sorts only the 15 newest inbox messages; there is no separate inbox-preview panel. It reads bounded plain text for those messages, submits it to the selected sorting model without a second confirmation, and applies clear app-owned category labels. A reply begins only for a message the student opens. No run starts on a schedule.

The selected sorting model supplies one category choice and a separate rubric-based reply-urgency estimate from [docs/category-policy.md](docs/category-policy.md). The UI places an animated, clickable category bar chart beside the reply urgency panel; email cards appear there only after a category bar is selected, ranked by urgency and each with a Reply button. There is no pilot-measures panel. Category-confidence bars appear only if the selected model supplies meaningful, validated category probabilities. After sorting stops, a category selection immediately invokes labeling without another confirmation. Its override is saved only after verified live labeling or sample success; a failure remains unresolved. Later sorts preserve that correction without rechecking its Gmail label. The selected drafting model proposes reply text after the student reviews the thread, sets a Professional-to-Warm tone slider, and chooses **Generate reply**. The generated reply is saved and remains editable. Changed text or recipient must be saved before sending; Save edits and Keep pending do not authorize a send. Saved replies can be reopened without retrieving the inbox again, and redrafts reuse saved thread context. There is no separate Write manually option. The workflow controller owns Gmail access, labels, approval state, and sending. Students can correct a category and edit or discard a draft. Neither model obtains a send tool or chooses recipients.

The app names the chosen sorting provider and discloses the bounded Gmail text sent to it before the student opens the live inbox. For reply drafting, it shows the exact selected thread text and names the chosen drafting provider before **Generate reply** sends that text. Message bodies can contain private information. Attachments are never opened or sent to either model in this version. The app stores account-scoped metadata, classification/override state, bounded reply-thread context, draft revisions, and operation evidence needed to resume and reconcile work. Saved records remain after disconnect; they are not a full mailbox archive. OAuth tokens and provider keys are stored outside the repository and never displayed in logs.

## Required source files for a later Build Agent run

- [Workflow of tasks](agent/workflow-of-tasks.md)
- [Task summary](agent/task-summary.md) and all linked task specifications
- [Category policy](docs/category-policy.md)
- [Integration and data boundaries](docs/integration-boundaries.md)
- [Acceptance scenarios](docs/acceptance-scenarios.md)

These files specify the agent. They do not implement an app, connect any account, or authorize a live send. During its model-selection stage, the Build Agent skill should help each student choose a sorting model that can return the five categories, an urgency estimate, and a review/uncertainty signal, plus a drafting model that can return editable reply text and missing-fact questions. The skill must verify each chosen provider's actual API capabilities, cost, and Gmail-data terms before live use. The task specifications define the required outputs and authority boundaries without prescribing model brands or IDs.

For a student repository, preserve this README, `agent/`, and `docs/` at their relative paths, then invoke `$build-agent-from-specs` for this application folder. Each student chooses models and configures credentials during that skill's tool and model stages. Do not place OAuth credentials, API keys, saved Gmail data, or local runtime state in the repository. The current implementation's `src/`, `web/`, tests, launcher, and model-specific run guide are not part of this specification package.

