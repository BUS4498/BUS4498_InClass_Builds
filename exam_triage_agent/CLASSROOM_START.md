# Classroom start: Exam Triage Agent

This folder contains the specification starter and the **local Exam Triage app**. Copy it into a new student repository or a clearly named app folder in the student's repository. Keep the README, workflow, every task specification, and both reference files together. No credentials or real student records belong in GitHub.

## Before the one-hour build

1. Confirm that the student's GitHub plugin/connection works in Codex or that their GitHub connection works in Claude Code. The build skill will verify the intended repository before publication.
2. Open the repository and read [README.md](README.md), [the workflow](agent/workflow-of-tasks.md), and the task specifications. Confirm the design baseline or approve a concrete correction plan if the skill finds a real issue.
3. Choose a **local browser app**. The first feature group needs no provider account. For a live Group 2 demonstration, the instructor can configure their TypeSafe Jev key as `TYPESAFE_API_KEY` in their own local backend's ignored environment file. If an existing private key file calls it `JEV_API_KEY`, map its value to the backend's expected name during secure local setup; do not put the key in the repository, browser, or student copies. A student who later builds Group 2 chooses a provider they can access (Jev, OpenAI, or Claude) and configures their own key outside chat and GitHub. Approve the provider and bounded test scope before any live model request.

To try the provided app, install Node.js 20.12 or newer, double-click `start.cmd`, and use the local browser page. The fictional example is unsaved until submitted. Close the command window with Ctrl+C and reopen with `start.cmd` to verify persistence. Group 1 needs no key. Group 2's Jev comparison becomes available only after a student or instructor configures their own ignored local `.env` and explicitly clicks Compare.

## Suggested class sequence

| Time | Student-visible result |
| --- | --- |
| 0–10 min | Repo and GitHub connection ready; inspect the small workflow. |
| 10–20 min | Review the skill's design audit and accept the baseline or correct a specific flaw. Defer the optional task-skill offer for this exercise. |
| 20–45 min | Build Group 1: input form, ranking, sprint, and local save/reload. |
| 45–60 min | Try a changed confidence value, an invalid input, and a reload; show the updated working result. Accept Group 1 after reviewing it. |

The timing is a teaching target, not a guarantee; account setup, publication approval, or debugging can require longer. Group 2 can follow later or be demonstrated by the instructor with a prepared Jev connection. Students without provider access still have a complete Group 1 app. Do not label an example response as a live Jev/OpenAI/Claude result.

## Invocation prompt

> Use the `build-agent-from-specs` skill on this repository's Exam Triage Agent. The application folder is the repository root unless I placed these files in a named subfolder. Build the approved groups in order. My first classroom goal is a working local Group 1 that I can open, use, reload, and review. Show the repository audit and corrections required by the skill. Treat Group 2 as a separate model comparison group; do not make a paid model call until the provider and test scope have been selected and authorized.

The build model in Codex or Claude Code consumes its own usage allowance. The optional model inside the finished app uses the selected provider's separate API account.
