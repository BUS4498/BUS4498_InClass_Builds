# H2: Review and Log Study

## Basic information

- **Task ID:** H2
- **Task owner:** Student
- **Automation level:** L0; the student judges their progress and selects actions.

## 1. Task description

The student reviews the ranked list and sprint. They may choose a different queued topic, revise an input, log actual study minutes and a new confidence rating, mark a topic done reviewing for this exam, or clear all app data after a confirmation. The app cannot infer that time was studied merely because the sprint was displayed. A model suggestion from T4 remains separate unless the student explicitly selects **Use this method for this sprint** while viewing the matching current sprint.

## 2. Inputs

- **Visible plan:** T2 and T3 results, with source version and reasons; T4 suggestion/status when requested.
- **Student decision:** Exact topic/action and, for a session log, minutes and new confidence. To adopt a model method, the student selects the saved suggestion for the current topic and context version. No action is a valid choice; the saved plan remains available.

## 3. Outputs and handoff

- **Chosen topic:** Sent to T3 to compose and save a sprint for that queued topic without changing the priority order.
- **Chosen change or log:** Sent to T1 for validation, save, and a fresh ranking. A clear request must pass a separate confirmation and is sent to T1 only after it is confirmed.
- **Model comparison request:** Sent to T4 for the current saved plan version and configured provider.
- **Chosen model method:** Send the allowed method, selected topic ID, and context version to T3 only after the student's explicit adoption action. If T3 reports a stale or invalid adoption, show that message and leave the prior sprint visible; the student may request a fresh comparison.
- **Complete when:** The selected student action is recorded or the student leaves the existing plan unchanged. There is no deadline; silence does not update a rating.

## 4. Planned tool support

The interface offers labeled controls for edit, choose, log, done reviewing, compare, adopt a current model method, and clear. The clear confirmation names the affected local data. Failed saves leave the prior durable version visible.
