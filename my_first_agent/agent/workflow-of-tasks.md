# Workflow of Tasks

> **Worked example:** This file shows one completed version of the Week 2 `workflow-of-tasks.md` template for the Internship Application Prep Agent.

## 1. Workflow Overview

### 1.1 Workflow Goal

This workflow supports the system goal defined in `my_first_agent/README.md`.

### 1.2 Workflow Trigger

A discovery run begins when the student selects **Collect Opportunities** or when a daily schedule previously approved by the student triggers the same bounded search. A targeted update begins when the student supplies requested information or asks for review-only preparation for one already tracked opportunity; a targeted update does not start a new internship-market search.

### 1.3 Completion Condition at Runtime

The run is complete when the bounded search, if applicable, has stopped; every selected opportunity has an evidence-backed assessment and next-action recommendation; any student-requested draft has either been prepared for review or recorded as unresolved; permitted record changes have been checked; unresolved issues have a named next step or student handoff; and the student can see the run summary. Completion never means that an application was submitted.

### 1.4 General Workflow

The system first performs **T1: Retrieve Student Context** to load the verified student profile, preferences, constraints, tracked opportunities, and any new student response. During a discovery run, it then performs **T2: Search Internship Sources**, using no more than three targeted public-web searches and screening no more than 15 candidate opportunities. **T3: Validate Opportunities** checks source evidence, required fields, initial relevance, hard constraints, and duplicates. It retains three to five valid new or materially changed opportunities when at least three qualify, never retains more than five, and does not add weak opportunities merely to reach the target. For each retained opportunity, **T4: Assess Opportunity Fit** compares posting requirements with verified student evidence, constraints, and preferences and identifies matches, gaps, and unknowns. **T5: Recommend Next Actions** uses that assessment to recommend prioritizing, monitoring, preparing, following up, archiving, or asking the student for input. A targeted update skips the market-search tasks and moves from T1 to T4 using the tracked posting evidence and the student's new response.

If the student explicitly requests preparation, **T6: Prepare Review-Only Materials** creates an evidence-grounded checklist, outline, or question worksheet with visible placeholders. The draft remains under a student review gate and cannot be treated as final or used in an application without the student's approval. After every selected opportunity has been handled, **T7: Record and Present Results** writes only permitted collection changes, checks the recorded result, and shows the student the decisions, evidence, drafts, and unresolved issues. If required evidence is missing or conflicting, the system asks a specific question and stops while awaiting the student rather than guessing. If no opportunity qualifies within the search limits, T7 records the shortfall and completes the run. The system does not submit applications, finalize materials, or contact employers.

### 1.5 Workflow Diagram

```mermaid
flowchart TD
    S0([Run starts]) --> D0{"Trigger type?"}
    D0 -->|Discovery| T1["T1: Retrieve Student Context"]
    D0 -->|Targeted update| T1
    T1 --> D1{"Required context available?"}
    D1 -->|No| H1["H1: Request Student Clarification"]
    H1 --> E1([Stop: Awaiting student])
    D1 -->|Yes| D2{"Discovery run?"}
    D2 -->|Yes| T2["T2: Search Internship Sources"]
    T2 --> T3["T3: Validate Opportunities"]
    T3 --> D3{"Valid new or changed opportunities?"}
    D3 -->|No| T7["T7: Record and Present Results"]
    D3 -->|Yes| T4["T4: Assess Opportunity Fit"]
    D2 -->|No| T4
    T4 --> D4{"Evidence supports an assessment?"}
    D4 -->|No| H2["H2: Request Targeted Clarification"]
    H2 --> E1
    D4 -->|Yes| T5["T5: Recommend Next Actions"]
    T5 --> D5{"Student requested preparation?"}
    D5 -->|Yes| T6["T6: Prepare Review-Only Materials"]
    T6 -. Review required before use .-> H3["H3: Student Reviews and Approves Final Materials"]
    T6 --> D6{"More selected opportunities?"}
    D5 -->|No| D6
    D6 -->|Yes| T4
    D6 -->|No| T7
    T7 --> C1([C1: Run Complete])
```
