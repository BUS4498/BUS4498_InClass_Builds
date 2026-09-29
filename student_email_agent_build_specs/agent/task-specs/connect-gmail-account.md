# Connect Gmail Account Task Specification

## Basic Information

- **Task ID:** H0
- **Task name:** Connect Gmail Account
- **Task type:** Act
- **Automation level:** L0 — the student grants or declines account access.
- **Task owner:** Student

## 1. Task Description

The student starts Gmail OAuth from the local app, checks the account and requested permissions, and consents through Google's authorization screen. The backend accepts only the returned account identity and tokens for this local instance. The student can disconnect. The app must show which account is active before sorting or drafting. A successful connection establishes access only: the app waits for the student to click **Open & sort live inbox** before retrieving inbox messages or starting a new sorting run. A new reply is selected from the retrieved emails after a category bar is opened. On a later app launch, saved credentials are shown as saved account access until a live request verifies them in that session. Sample mode is available without connection and makes no live Gmail or model calls. Disconnect removes local credentials and attempts revocation; account-scoped saved review records remain available after reconnecting to that account.

## 2. Inputs

### Input 1

- **Input name:** Student connection choice
- **Contents and format:** Explicit connect or disconnect action from the local browser.
- **Source:** Student

- **If a required input is missing or invalid:** Stay disconnected; no mailbox or model call begins.

## 3. Outputs

### Output 1

- **Output name:** Connection status
- **Contents and format:** Authenticated or saved account identity, connection/verification state, or disconnected/error status without token values. A saved account indicator is not proof of a successful Gmail request in the current session.
- **Next task or recipient:** Student; T1 only after Open & sort live inbox, or saved-work controls for an existing run
- **Complete when:** The displayed account matches the authenticated Gmail profile, or the student sees why connection failed.

## 4. Planned Tools

### Tool 1

- **Tool name:** `connect_gmail_account`
- **Input:** Student connection choice
- **Output:** Connection status
- **Implementation Route:** Local OAuth loopback flow and Gmail profile API
- **Integration approach:** Direct integration
- **Role in this task:** Initiates the Google consent flow and checks the returned account; it cannot grant consent for the student.
- **Task timeout:** 5 minutes for the browser authorization session.
- **Maximum retries:** 0 automatic retries.
- **Retry only when:** Not applicable; the student may start a new connection attempt.
- **On timeout, exhausted retries, or an error that cannot be retried:** Remain disconnected and show a reconnect action.
