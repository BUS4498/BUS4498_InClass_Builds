# T4: Compare Model Suggestion

## Basic information

- **Task ID:** T4
- **Task owner:** Local application controller and one configured model provider
- **Automation level:** L2; one bounded model-supported choice after an explicit student request.

## 1. Task description

For the current saved sprint, ask one configured provider to choose among **active recall**, **practice problems**, and **teach back**. The controller owns the workflow and validates the returned choice. Jev supplies a typed choice and probabilities; an OpenAI or Claude model may also supply a short rationale. Display the provider suggestion next to the rule-based sprint, with its actual source and status. The student decides whether to use the proposed method. Provider confidence, when available, describes certainty about the choice; it is not a measure of student mastery.

## 2. Inputs

- **Current saved sprint and context version:** T3 output, selected topic ID and label, student-entered difficulty note when supplied, importance, confidence, exam format, computed days remaining, available minutes, and selected provider.
- **Student request:** The student selects **Compare a model suggestion** after the interface states which fields will be sent to the provider. No request occurs on page load, save, or refresh.
- **Provider configuration:** Server-side model ID and secret reference; one provider is selected per request. A missing key or unavailable provider is a status, not a prompt to enter a key in the browser.

## 3. Outputs and handoff

- **Validated suggestion:** One allowed method, provider/model ID, current context version, selected topic ID, time, and optional provider rationale. Jev's probability distribution and confidence may be shown with a plain-language label but cannot be interpreted as a grade prediction. H2 receives the suggestion as an option for that topic and version only.
- **Unavailable, failed, invalid, or stale result:** A specific status and recovery step; the existing T3 sprint and ranking remain usable. A result for an older context version or a different selected topic cannot appear as current.
- **Complete when:** The returned result or status is saved with read-back for the right context version and displayed honestly. No student progress or topic ranking is changed by T4.

## 4. Planned tool and limits

`suggest_study_method` is a local-backend provider adapter. It sends only the listed compact context, never the student's name, other exams, or full study history. Jev calls TypeSafe's System One **Choice** API with exactly the three allowed methods. OpenAI uses the Responses API and Claude uses the Messages API; both must return a method from the same list. The controller validates model outputs before displaying them. At most **one provider request per student click**, a **20-second task deadline**, and **zero automatic retries**. Reuse a valid suggestion only for the same context version, selected topic ID, and provider instead of silently calling again. See [model paths](../../docs/references/model-paths.md).
