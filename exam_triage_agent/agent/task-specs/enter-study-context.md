# H1: Enter Study Context

## Basic information

- **Task ID:** H1
- **Task owner:** Student
- **Automation level:** L0. The student supplies judgments and decides what to study.

## 1. Task description

The student enters or revises the one-exam context defined in [study rules](../../docs/context/study-rules.md). The interface shows the saved values on return visits. The student may leave the app without submitting; silence is not confirmation. A student-entered difficulty note is treated as an input, not as a course fact established by the app.

## 2. Inputs

- **Student values:** Exam name/date/format, available minutes, and one to six topics with name, importance, confidence, optional difficulty note, and queue status.
- **Prior values, when present:** The latest saved local version from T1. An empty history is normal for a first visit.
- **Missing or invalid input:** The form identifies the field and keeps the previous valid saved version. It does not invent a confidence rating, date, or importance.

## 3. Outputs and handoff

- **Draft study context:** Student-authored values and a submit action to T1. A revised draft supersedes an earlier submitted value only after T1 validates and saves it.
- **Complete when:** The student submits a draft. Human waiting has no automatic timeout or approval.

## 4. Planned tool support

The browser form supports entry, editing, and accessible validation messages. It does not choose values or invoke a provider model. A failed display or save is reported as an application error, not a student judgment.
