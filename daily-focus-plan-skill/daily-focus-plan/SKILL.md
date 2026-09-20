---
name: "daily-focus-plan"
description: "Turn supplied tasks, durations, and available time into a realistic daily focus plan. Use when the user asks to plan their day or prioritize a task list. This Skill drafts a plan; it does not edit calendars."
---

# daily-focus-plan

## Dynamic user inputs
The user supplies tasks, estimated durations in minutes, known deadlines, and available time. Ask for tasks, estimated durations in minutes, deadlines, and available time when missing. Treat an unspecified deadline as unknown.

## Static inputs
No static inputs are required for this version.

## Procedure
1. Read the supplied tasks, durations, deadlines, and available time.
2. Prioritize urgent deadlines; if priorities conflict, ask the user which matters most.
   - Use [planning-rules.md](references/planning-rules.md): Before allocating time, consult this guide and apply its buffer and priority rules. Show the buffer separately in the plan.
3. Select work that fits the time available. Show deferred tasks instead of silently dropping them.
4. Add the planned durations and check that the total does not exceed the available time.
   - Use [sum_minutes.py](scripts/sum_minutes.py): When checking the sum of planned durations, run this Python 3 tool with each duration as an argument. If Python is unavailable, calculate the total directly and state that the tool was not run.
5. Return the plan and one concrete first action.

## Output
Return a short plan with: planned tasks and minutes; total planned time; time remaining; deferred tasks with reasons; and the first action.
- Use [daily-plan-template.md](assets/daily-plan-template.md): When presenting the final daily plan, use this template’s headings and replace its placeholders with the current task details.

## Boundaries
Do not invent tasks, durations, or deadlines. Do not edit calendars, contact anyone, or mark tasks complete. If an urgent task cannot fit, make the conflict visible and ask the user how to proceed.
