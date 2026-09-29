# Present and Verify Results Task Specification

## Basic Information

- **Task ID:** T6
- **Task name:** Present and Verify Results
- **Task type:** Verify
- **Automation level:** L1 — deterministic status reconciliation and display.
- **Task owner:** Local workflow controller

## 1. Task Description

Show the user a run summary and individual message outcomes. For sorting, place animated clickable bars for the five categories and separate Needs review group beside the reply urgency panel. Email cards appear in that panel only after a category bar is selected and are then ranked by urgency for the current batch, with unavailable scores last. Clear selection hides the cards again; category counts update as processing proceeds. Saved pending queues retain saved-record ordering. Each shown email has a Reply control and urgency score or unavailable state; Reply is enabled only for the current mode and a successfully retrieved message in the current inbox batch, even if its category or label remains unresolved; show category-confidence bars on demand only when the chosen model supplies meaningful, validated probabilities. Distinguish labeled, awaiting category review, skipped, unprocessed after cancel or limit, empty, failed, and unknown; use T3 read-back evidence for label mutations rather than assuming success. A preserved saved correction carries label status not rechecked, not fresh verification. Needs review groups category uncertainty, label failures/unknown outcomes, and unprocessed items. Show missing urgency as unavailable. Preserve completed verified labels on cancellation. Present `complete`, `awaiting user`, and `failed/unknown` as distinct run states; a pending H1 item remains reachable after reopening through **Review pending categories**. For replying, expose Open pending replies and Send results, showing saved/discarded, sent with Gmail evidence, failed, or unknown. Definite failures can return to H2 for fresh review; unknown sends offer the read-only Check Gmail Sent again action through T5 and remain blocked from resend. Never display a sample result as live data. Keep a clear action to review a category, reconnect, edit a draft, or inspect an uncertain send. The dashboard has no separate inbox-preview or pilot-measures panel. Use a bright violet, coral, blue, and teal visual system with a gradient welcome area, rounded category cards, and expressive motion. Honor reduced-motion preferences, keyboard operation, and narrow screens by stacking the two panels without horizontal overflow.

## 2. Inputs

### Input 1

- **Input name:** Run and operation results
- **Contents and format:** Run ID, account ID, message IDs, classifications and pending review versions, label verification, cancelled/unprocessed counts, draft attempt count and send states, errors, and fixture/live mode.
- **Source:** T1–T5 and H1–H2

- **If a required input is missing or invalid:** Show an explicit unknown/error state, not success.

## 3. Outputs

### Output 1

- **Output name:** Student-visible result
- **Contents and format:** Run counts, complete/awaiting/failed or unknown run state, per-message category and status including unprocessed, send evidence or unknown outcome, next action, and mode/connection badge.
- **Next task or recipient:** Student
- **Complete when:** The displayed statuses agree with persisted operation records and the evidence recorded by T3/T5 for requested mutations. Distinguish historical evidence and preserved corrections from a fresh Gmail check.

## 4. Planned Tools

### Tool 1

- **Tool name:** `present_verified_results`
- **Input:** Run and operation results
- **Output:** Student-visible result
- **Implementation Route:** Local operation state and browser dashboard; Gmail verification belongs to T3/T5
- **Integration approach:** Direct integration
- **Role in this task:** Presents recorded evidence and next actions. It does not independently retry Gmail operations; requested Sent reconciliation routes to T5.
- **Task timeout:** No separate Gmail verification deadline. Present persisted results as available; upstream T3/T5 own their bounded network deadlines.
- **Maximum retries:** 0 independent operation retries.
- **Retry only when:** Not applicable to presentation; a student can explicitly request read-only Sent reconciliation through T5.
- **On timeout, exhausted retries, or an error that cannot be retried:** Display unknown/verification pending and keep the recovery action visible.
