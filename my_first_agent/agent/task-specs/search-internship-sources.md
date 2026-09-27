# Search Career Sources Task Specification

> **Worked example:** Automation levels, tool names, data structures, and operating limits in this specification are proposed design defaults. The workflow's eight query/API attempts, 40 screened leads, and 24 posting reads are required ceilings.

## Basic Information

- **Task ID:** T2
- **Task name:** Search Career Sources
- **Task type:** Retrieve
- **Task owner:** Career Opportunity Prep Agent; the student controls search scope and schedule approval.
- **Automation level (proposed):** L1.

## 1. Task Description

For a discovery run, retrieve internship and/or entry-level job leads using a fixed plan built from the student's confirmed resume-supported role interests, selected timeframe and role types, and explicit location constraints. Read `my_first_agent/docs/references/job-search-sources.txt` as the source registry. Use only enabled public or authorized routes whose actual runtime access has been checked; mark each named source used, attempted, skipped, restricted, or inaccessible. Record query text, source/route, scope version, and order before execution. Do not use results to generate additional searches or expand the student's scope. A registered site is not a promise that the agent can search it automatically.

Perform no more than eight query/API attempts, screen no more than 40 leads, and make no more than 24 posting-page reads across the entire run. Process results in planned-source order and returned-result order, deduplicate lead links, and retain the screening count even when a lead is rejected. Search snippets and job-board listings are leads, not verified employer evidence. Use the lead's exact employer career or authorized ATS link when available for the permitted posting read; an official USAJOBS announcement may be authoritative for a federal role. Otherwise leave employer corroboration unverified. Preserve lead and checked posting URLs separately, source type, retrieval time, job identifier, and access status. Do not automate login, bypass restrictions, read unrelated pages, or contact employers.

Record an individual denied, missing, or unreadable posting page as a skipped lead and continue in predetermined order within the global budgets. A source-specific restriction is logged and the next permitted planned source may continue. A search-service failure affecting all remaining routes, global deadline, or systemic processing error stops further retrieval. Neither a skipped page nor a secondary listing becomes a verified posting from its snippet or URL alone. Do not promise three to five scored results or two to three questions when the evidence is unavailable.

Pass available evidence to T3: Validate Opportunities. T3 determines which opportunities qualify. T2 cannot guarantee three to five results and must not broaden the search to meet that target. Targeted updates skip this task entirely.

## 2. Inputs

### Input 1

- **Input name:** Verified student context
- **Contents and format:** T1's confirmed resume-derived role interests, selected timeframe and role types, preferences, constraints, scope version, run ID, and discovery trigger. Use only the minimum search terms needed; exclude private identity, contact details, and verbatim resume contents from public queries.
- **Source:** T1: Retrieve Student Context.

### Input 2

- **Input name:** Opportunity history
- **Contents and format:** T1's spreadsheet snapshot with existing opportunity IDs, lead and authoritative source links, last-seen times, and versions. Previously tracked postings may be returned for T3 to check for changes.
- **Source:** T1: Retrieve Student Context.

- **If a required input is missing or invalid:** Record the missing resume/scope criterion or invalid trigger and route it to H1. Do not run searches for a targeted update or infer timeframe, role type, or a hard constraint. An explicitly empty first-run spreadsheet is valid.

## 3. Outputs

### Output 1

- **Output name:** Candidate opportunity evidence
- **Contents and format:** List of no more than 40 screened leads, of which no more than 24 have an attempted posting read. Each entry includes candidate ID, discovery order, query/source reference, lead URL, checked posting URL when available, source type (employer/authorized ATS, official USAJOBS, secondary, or unconfirmed), retrieval time, employer, role, job identifier when stated, posting excerpts, and access status. Keep unavailable requirements, dates, location, deadline, compensation, and open/closed status unknown; preserve individual failures.
- **Next task or recipient:** T3: Validate Opportunities.
- **Complete when:** Every screened candidate has an evidence entry or an explicit access-failure entry, and the search and screening caps have been honored. An empty list is a valid bounded result.

### Output 2

- **Output name:** Search run log
- **Contents and format:** Run ID, confirmed scope version, fixed query texts, access route and attempted/used/skipped/restricted/inaccessible status for each registry source, query/API-attempt, lead, posting-read, and skipped-page counts, timestamps, access failures, service failures, and stopping reason: plan completed, query cap, lead cap, page cap, timeout, or systemic service error. Distinguish an empty bounded search, source restriction, and broader service failure.
- **Next task or recipient:** T3: Validate Opportunities and T7: Record and Present Results; the student receives unresolved service or access issues through T7.
- **Complete when:** Actual attempts and failures are counted and a reader can distinguish no qualifying evidence from an incomplete search.

## 4. Planned Tools

### Tool 1

- **Tool name:** search_career_sources
- **Input:** Verified student context; Opportunity history.
- **Output:** Candidate opportunity evidence; Search run log.
- **Implementation Route:** Functions/scripts to fill and execute the fixed query sequence, with web API calls for public search and public posting retrieval.
- **Integration approach:** Direct integration.
- **Role in this task:** Return source evidence under a predetermined accessible-source sequence. The tool does not use a model to choose searches, score fit, update the spreadsheet, or submit applications. Failed query/API attempts count toward the eight-attempt cap and failed posting reads count toward the 24-read cap; skipped leads do not extend any limit.
- **Task timeout:** 480 seconds total for the entire task. Each external call has a 15-second maximum or the remaining task time, whichever is shorter.
- **Maximum retries:** 0.
- **Retry only when:** Not applicable.
- **On timeout, exhausted retries, or an error that cannot be retried:** For one denied, missing, or unreadable posting page, record its lead-level failure, count the attempted read, and continue within budgets; do not retry or treat the page as verified. For a source-specific restriction, log the source and continue with the next permitted planned route. For a systemic search failure, global timeout, or processing error, stop retrieval, mark Search run log incomplete with the failed operation and counters, and return available evidence to T3. T7 shows actual shortfalls and coverage; a systemic failure cannot be reported as completed discovery.
