# About the Agentic System

**Exam Triage Agent**

> **Problem to be solved:** Before an exam, a student may have several topics to review and limited study time. Choosing a topic by habit can leave an important weak area untouched. The student needs a short, revisable recommendation based on their own exam date, topic importance, and confidence. The system must show why it chose a topic and update its recommendation after the student reports what happened in a study session.

### System Designer Name

BUS 4498 classroom starter. Students may replace this line with their names.

### System Name

Exam Triage Agent

### System Goal

**For** an undergraduate preparing for one upcoming exam, **improve** the ability to choose a next study topic and act on it, **measured by** a saved, ranked topic list with visible input-based reasons, one usable study sprint, and an updated recommendation after the student logs a session, **without** predicting a grade, claiming mastery, inventing course content, or changing the student's final choice.

### Who Is Better Off When This Works?

The student can start a focused study session and see how their own progress changes the next recommendation.

## Application boundary

- The first version is a **single-user local browser app** with a small backend bound to the student's own computer. It saves app state in a local `data/exam-triage.json` file excluded from Git. It runs independently after setup; it does not need a new Codex or Claude Code conversation for each study session.
- The student enters one exam name, date, exam format, today's available study minutes, and one to six topics. For each topic the student selects importance and current confidence. A short note about a topic's difficulty is optional.
- The controller calculates dates, priority, and time in code using [study rules](docs/context/study-rules.md). The first three unfinished topics appear in rank order with the inputs and calculation behind each priority. A suggested sprint for the top topic is ready even when no provider API is configured.
- The student can edit inputs, choose another topic, log minutes studied and a revised confidence level, and clear their own saved data. A new ranking uses the revised values. A score expresses **review priority**, not likely exam performance.
- **Compare a model suggestion** is a separate, optional action. One configured provider may suggest a study method from the three allowed methods. [Model paths](docs/references/model-paths.md) explain Jev, OpenAI, and Claude. A provider suggestion never silently replaces the rule-based plan; the student may choose it. The UI shows the provider and whether the suggestion is live, unavailable, or failed.
- The app does not connect to an LMS, search the web, import course documents, schedule notifications, or send student data to a provider without the student's model-comparison request.

## One-hour classroom target

Build and review **Group 1: working local study loop**: enter inputs, rank topics, show a sprint, save/reopen, and update after a logged session. **Group 2: one model comparison path** is an extension when a provider account and key have been prepared. The repository documents describe both groups so the build skill can plan them, but Group 1 is the visible one-hour result. The student must accept the first group before the skill proceeds to Group 2.

## Source map

- [Workflow of tasks](agent/workflow-of-tasks.md)
- [H1: Enter study context](agent/task-specs/enter-study-context.md)
- [T1: Validate and save context](agent/task-specs/validate-and-save-context.md)
- [T2: Rank exam topics](agent/task-specs/rank-exam-topics.md)
- [T3: Build study sprint](agent/task-specs/build-study-sprint.md)
- [T4: Compare model suggestion](agent/task-specs/compare-model-suggestion.md)
- [H2: Review and log study](agent/task-specs/review-and-log-study.md)
- [Static study rules](docs/context/study-rules.md)
- [Model paths and sources](docs/references/model-paths.md)

No application code, provider credentials, or example student records are included in this specification starter.
