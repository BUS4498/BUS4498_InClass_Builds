# Search Internship Sources Task Specification

> **Worked example:** Automation levels, tool names, data structures, and operating limits in this specification are proposed design defaults. The workflow's limits of three searches and 15 candidates are required.

## Basic Information

- **Task ID:** T2
- **Task name:** Search Internship Sources
- **Task type:** Retrieve
- **Task owner:** Internship Application Prep Agent; the student controls search scope and schedule approval.
- **Automation level (proposed):** L1.

## 1. Task Description

For a discovery run, retrieve public internship postings using a fixed search plan built from the verified student's stated role interests, internship period, and explicit location constraints. Fill at most three predefined query templates before searching: role and period; role, period, and location; and role and period restricted to a public employer career source. Use only templates supported by the supplied context; record the query text and order before execution. Do not use results to generate additional queries or expand the student's scope.

Perform no more than three public-web search calls and screen no more than 15 candidate opportunities across the entire run. Process results in query order and returned-result order, deduplicate source links, and retain the screening count even when a candidate is rejected. Search-result snippets are leads, not verified posting evidence. Retrieve at most one public posting page per screened candidate, up to 15 page reads total, and preserve its source and retrieval time. Do not log in, bypass access restrictions, follow unrelated links, or contact employers.

Pass available evidence to T3: Validate Opportunities. T3 determines which opportunities qualify. T2 cannot guarantee three to five results and must not broaden the search to meet that target. Targeted updates skip this task entirely.

## 2. Inputs

### Input 1

- **Input name:** Verified student context
- **Contents and format:** T1's source-labeled profile, preferences, constraints, run ID, and discovery trigger. Use only the information needed to construct the fixed queries; exclude private student identity, contact details, and resume contents from public search queries.
- **Source:** T1: Retrieve Student Context.

### Input 2

- **Input name:** Opportunity history
- **Contents and format:** T1's collection snapshot with existing opportunity IDs and public source links. Previously tracked postings may be returned for T3 to check for material changes.
- **Source:** T1: Retrieve Student Context.

- **If a required input is missing or invalid:** Record the missing search criterion or invalid trigger and route it to H1: Request Student Clarification. Do not run searches for a targeted update or infer missing constraints. An explicitly empty collection is valid.

## 3. Outputs

### Output 1

- **Output name:** Candidate opportunity evidence
- **Contents and format:** List of no more than 15 screened candidates. Each entry includes a candidate ID, discovery order, query reference, employer and role when stated, public source URL, retrieval time, posting text or source-labeled excerpts, and page-access status. Keep unavailable requirements, dates, location, deadline, or compensation unknown; preserve retrieval failures rather than inventing values.
- **Next task or recipient:** T3: Validate Opportunities.
- **Complete when:** Every screened candidate has an evidence entry or an explicit access-failure entry, and the search and screening caps have been honored. An empty list is a valid bounded result.

### Output 2

- **Output name:** Search run log
- **Contents and format:** Run ID, fixed query texts, search and page-read counts, screened-candidate count, timestamps, service failures, and stopping reason: plan completed, search cap, candidate cap, timeout, or service error. Include whether discovery coverage was incomplete.
- **Next task or recipient:** T3: Validate Opportunities and T7: Record and Present Results; the student receives unresolved service or access issues through T7.
- **Complete when:** Actual attempts and failures are counted and a reader can distinguish no qualifying evidence from an incomplete search.

## 4. Planned Tools

### Tool 1

- **Tool name:** search_internship_sources
- **Input:** Verified student context; Opportunity history.
- **Output:** Candidate opportunity evidence; Search run log.
- **Implementation Route:** Functions/scripts to fill and execute the fixed query sequence, with web API calls for public search and public posting retrieval.
- **Integration approach:** Direct integration.
- **Role in this task:** Return source evidence under a predetermined sequence. The tool does not use a model to choose searches, score fit, update the collection, or submit applications. Search attempts count toward the three-call cap even when they fail; page reads do not permit additional searches or candidates.
- **Task timeout:** 180 seconds total for the entire task. Each external call has a 15-second maximum or the remaining task time, whichever is shorter.
- **Maximum retries:** 0.
- **Retry only when:** Not applicable.
- **On timeout, exhausted retries, or an error that cannot be retried:** Stop further retrieval, mark Search run log incomplete with the failed operation and counters, and return evidence already retrieved to T3 for validation. If no usable candidates remain, the workflow routes through T3 to T7 to present the unresolved issue or shortfall to the student; it must not report a completed market search.
