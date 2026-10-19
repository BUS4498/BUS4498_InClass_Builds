# Model paths for Exam Triage Agent

Checked against the course AI model reference and provider documentation on **2026-09-28**. Recheck model IDs, access, and prices when students build or run the app. The first working study loop uses fixed rules; **Compare a model suggestion** is an explicit optional request. One connected provider is sufficient for Group 2. Students do not need all three providers.

| Path | Suitable job in this example | Output | Required access | Main limitation |
| --- | --- | --- | --- | --- |
| [TypeSafe Jev 1.13](https://docs.typesafe.ai/models), `jev-1.13.0` | Choose a study method from three named options | Typed choice, probabilities, confidence | TypeSafe API access and a server-side `TYPESAFE_API_KEY` | No free-form study-plan prose; keep date math and ranking in code. Students without access cannot run this path in their own copy. |
| [OpenAI GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), `gpt-6-luna` | Choose the method and optionally explain the choice in one short sentence | Structured method and short text | OpenAI API account and server-side `OPENAI_API_KEY` | A plausible explanation still needs input grounding and output validation. |
| [Claude Haiku 4.5 or Sonnet 5.5](https://platform.claude.com/docs/en/models/overview), `claude-haiku-4-5-20251001` or `claude-sonnet-5-5` | Choose the method and optionally explain the choice | Validated method and short text | Claude API account and server-side `ANTHROPIC_API_KEY` | Haiku is the lower-cost comparison; Sonnet is a more capable, costlier choice for this small task. |

The course workbook lists Jev for structured workflow choices, GPT-6 Luna for routine low-cost text tasks, and Claude tiers for text work. The current Claude model page may name a newer Sonnet version than the dated workbook; use the current official model ID rather than assuming a display name is a callable ID. Provider charges use different units: Jev bills input tokens, while OpenAI and Claude list input and output token rates. A Codex/ChatGPT or Claude Code subscription does not by itself give this application an API key. [OpenAI API models](https://developers.openai.com/api/docs/models), [Claude API overview](https://platform.claude.com/docs/en/api/overview), [TypeSafe API](https://docs.typesafe.ai/api).

For an instructor Jev demonstration, the app backend expects `TYPESAFE_API_KEY`. If an existing private file labels the same credential `JEV_API_KEY`, map its value to `TYPESAFE_API_KEY` in the ignored backend environment configuration. Keep the value out of this repository and student copies.

## The same decision across providers

The controller supplies a compact state such as: `exam_format`, `topic_name`, `confidence`, `importance`, `difficulty_note` if provided, `days_remaining` computed in code, and `available_minutes`. The allowed answer is one of `active_recall`, `practice_problems`, or `teach_back`. The controller keeps the rule-based suggestion and student input evidence visible beside any model answer. It does not ask any model to calculate dates, scores, or minutes.

### Jev: typed choice

With authorized TypeSafe access, the local backend sends a JSON request to `POST https://api.typesafe.ai/v1/systemone` using a Bearer API key. The compact body below illustrates the [documented Choice request shape](https://docs.typesafe.ai/api); values shown are **schema examples**, not a student record or a live response.

```json
{
  "model": "jev-1.13.0",
  "state": {
    "exam_format": "problem solving",
    "topic_name": "example topic",
    "confidence": 1,
    "importance": "must know",
    "days_remaining": 4,
    "available_minutes": 25
  },
  "questions": {
    "study_method": {
      "type": "choice",
      "instructions": "Choose one useful study method for the next session from the criteria. Use the supplied state only. Do not calculate dates or priority, and do not assume the student has course problems unless stated.",
      "criteria": {
        "active_recall": "Recall ideas from memory, then check against course material.",
        "practice_problems": "Work through relevant course problems when the exam is problem based and such problems are available.",
        "teach_back": "Explain the topic aloud or in writing, then check the explanation against course material."
      }
    }
  }
}
```

The backend reads `answers.study_method.choice`, validates it against the three keys, and may display the returned probabilities/confidence as **model uncertainty about this choice**. TypeSafe's [model limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13) say to keep arithmetic and date comparisons in code and use a generative model for prose. The instructor can demonstrate Jev with a securely configured key in their own backend. A student's separate copy needs its own authorized TypeSafe access; do not distribute the instructor key.

### OpenAI or Claude: structured choice with short prose

- **OpenAI path:** Call the [Responses API](https://developers.openai.com/api/docs/guides/text) from the local backend using `gpt-6-luna`. Request a [structured output](https://developers.openai.com/api/docs/guides/structured-outputs) with `method` from the three allowed values and a rationale of at most two sentences. Give only the compact current state and the instruction to avoid unsupported course claims.
- **Claude path:** Call the [Messages API](https://platform.claude.com/docs/en/api/overview) from the local backend using an account-available Haiku or Sonnet model. Request the same method and rationale fields; parse and validate the returned content rather than assuming it obeys the prompt.
- For both, reject an unknown method, empty response, or stale context version. Show a provider failure without changing the saved rule-based sprint. Never place an API key or raw provider response in frontend code, GitHub, or a browser download.

## Classroom comparison

Ask students: *Which parts belong in code, which require student judgment, and where could a model help?* The date calculation, ranking rule, time allocation, persistence, and permission to make a provider request stay with the controller. The student's confidence and final method choice stay with the student. Jev can make the bounded method choice; OpenAI or Claude can make that choice and express a short explanation. Compare the provider suggestion with the visible rule-based suggestion on the same input version, without treating agreement as proof of correctness.
