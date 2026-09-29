# T1: Validate and Save Context

## Basic information

- **Task ID:** T1
- **Task owner:** Local application controller
- **Automation level:** L1; fixed validation and local record operations.

## 1. Task description

On app open, read and validate the latest local snapshot when one exists. Validate an H1 submission or an H2 update against [study rules](../../docs/context/study-rules.md). Save a new local version and read it back before claiming it is saved. A logged session changes only the selected topic's recorded progress and confidence. A confirmed clear request removes this application's local records and verifies their absence. The browser stores no provider key.

## 2. Inputs

- **Study context draft or saved snapshot:** H1's exam, time, and topics; the latest local snapshot on app open; or the previously saved context plus H2's exact change.
- **Session update, when present:** Topic ID, actual minutes, revised confidence, timestamp, or queue-status change from H2.
- **Clear request, when present:** H2's explicit confirmation for this app's local data. No unconfirmed clear occurs.

## 3. Outputs and handoff

- **Saved context version:** Validated fields, stable topic IDs, version, and read-back status for T2. Invalid fields return to H1/H2 with specific messages and leave the previous saved version intact.
- **Cleared status:** Verified empty app records, returned to setup. A removal/read-back failure reports incomplete clearing.
- **Complete when:** An opened snapshot has been read and validated, or the intended write or clear is confirmed by read-back. A storage failure is operationally incomplete; no later task treats an unsaved change as durable.

## 4. Planned tool

`local_study_store` reads, writes, and clears only `data/exam-triage.json` through the local backend bound to the student's computer. There is no external network action. Each submit has one write and one read-back; no automatic write retry. A zero-minute log preserves the last-studied time. The controller prevents an older open tab from overwriting a newer saved version without asking the student to reload.
