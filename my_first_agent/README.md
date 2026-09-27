# About the Agentic System

> **Worked example:** This file shows one completed version of the Week 2 `README.md` template. It uses a fictional internship-search and application-preparation scenario.

**Career Opportunity Prep Agent**

> **Problem to be solved**: A student has an existing resume but searches many career sites manually for internships or entry-level jobs in a chosen timeframe. Posting details may be incomplete, duplicated, changed, or inaccessible; the resume may omit facts needed to judge eligibility or fit. For this fictional worked example, use the following current baseline: a typical manual search produces an average of two opportunities with a verified source, documented fit rationale, and clear next action. The student needs a bounded, evidence-based workflow that finds and ranks supported opportunities, asks useful questions about promising uncertain cases, keeps a private job opportunity ledger with a downloadable spreadsheet, and provides review-only preparation and optional scheduled email digests without taking control of career decisions or submitting an application.

### System Designer Name

BUS 4498 Instructor Example

### System Name

Career Opportunity Prep Agent

### System Goal

**For** a student who uploads an existing resume and chooses a search timeframe and role types, **improve** the student's ability to review relevant opportunities, **measured by** the number of source-verified, ledger-persisted postings per discovery run with an evidence-backed 1–5 fit score, stable rank, and clear next step **moving from** an average of two **to** a target of three to five when that many qualify, while separately showing up to two to three promising source-verified postings whose assessment or rank needs a specific student-answerable fact, **without** adding weak opportunities to meet a quota, treating missing resume facts as gaps, fabricating qualifications, submitting applications, changing final materials, or contacting employers without the student's explicit approval. A successful run may return fewer in either group and must show the shortfall, source coverage, and unresolved questions. Scored counts exclude held, unprocessed, inaccessible, unscored, and unverified records; targeted updates do not count as discovery runs.

### Who Is Better Off When This Works?

The student is better off because they receive ranked postings with visible evidence, targeted questions for uncertain opportunities, a private hosted job ledger with a locally downloadable `.xlsx` spreadsheet, optional scheduled digests, and review-only resume, cover-letter, and interview preparation while retaining final authority over every application and employer communication. One shared Codex Site requires student sign-in and keeps each student's resume, results, and decisions in owner-scoped Supabase records and private file storage. A scheduled run updates those hosted records; it cannot silently update a file already downloaded to a student's device. Resume originals, student records, and secrets are never published to the source repository or another student's view.
