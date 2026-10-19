# T2: Rank Exam Topics

## Basic information

- **Task ID:** T2
- **Task owner:** Local application controller
- **Automation level:** L1; deterministic calculation.

## 1. Task description

Rank topics still in the study queue using the precise formula and tie rules in [study rules](../../docs/context/study-rules.md). The ranking uses only the student's current saved values and recorded study history. Compute days until exam in code. A priority index is not a grade forecast or evidence of mastery.

## 2. Inputs

- **Saved context version:** Read-back-verified T1 output, including exam date, topic IDs, importance, confidence, queue status, entry order, and last study time.
- **Invalid or unavailable input:** Stop with the specific operational error; do not rank a stale or partial unsaved version as current.

## 3. Outputs and handoff

- **Ranked topic list:** Up to three leading queue topics plus remaining topics, stable IDs, current scores, calculation inputs, reasons, tie-break explanation when needed, source version, and honest shortfall if fewer than three qualify. Send the top topic and list to T3.
- **Empty result:** If all topics are marked done reviewing, show that status and provide an edit/reopen action. Do not fabricate a new topic.
- **Complete when:** Every queued topic is accounted for exactly once and the displayed order matches the fixed rule.

## 4. Planned tool

`rank_topics` is a pure local calculation with no API calls or retries. A malformed record produces a validation failure for T1 recovery rather than a plausible score.
