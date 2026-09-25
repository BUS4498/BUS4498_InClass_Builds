---
name: "daily-focus-plan"
description: "Turn supplied tasks, durations, and available time into a realistic daily focus plan. Use when the user asks to plan their day or prioritize a task list. This Skill drafts a plan; it does not edit calendars."
---

# daily-focus-plan

## User inputs
The user supplies tasks, estimated durations in minutes, known deadlines, and available time. Ask for available time or missing task durations before scheduling. Treat an unspecified deadline as unknown.

## Procedure
1. Read the supplied tasks, durations, deadlines, and available time.
2. Prioritize urgent deadlines; if priorities conflict, ask the user which matters most.
3. Select work that fits the time available. Show deferred tasks instead of silently dropping them.
4. Add the planned durations and check that the total does not exceed the available time.
5. Return the plan and one concrete first action.

## Output
Return a short plan with: planned tasks and minutes; total planned time; time remaining; deferred tasks with reasons; and the first action.

## Boundaries
Do not invent tasks, durations, or deadlines. Do not edit calendars, contact anyone, or mark tasks complete. If an urgent task cannot fit, make the conflict visible and ask the user how to proceed.
