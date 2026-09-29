# Task Summary

| Task ID | Task name | Specification file address |
| --- | --- | --- |
| H0 | Connect Gmail Account | [task-specs/connect-gmail-account.md](task-specs/connect-gmail-account.md) |
| T1 | Retrieve Selected Inbox Batch | [task-specs/retrieve-selected-inbox-batch.md](task-specs/retrieve-selected-inbox-batch.md) |
| T2 | Classify Student Mail | [task-specs/classify-student-mail.md](task-specs/classify-student-mail.md) |
| H1 | Review Category Choice | [task-specs/review-category-choice.md](task-specs/review-category-choice.md) |
| T3 | Apply Student Category Label | [task-specs/apply-student-category-label.md](task-specs/apply-student-category-label.md) |
| T4 | Draft Reply | [task-specs/draft-reply.md](task-specs/draft-reply.md) |
| H2 | Review Reply and Authorize Send | [task-specs/review-reply-and-authorize-send.md](task-specs/review-reply-and-authorize-send.md) |
| T5 | Send Approved Reply | [task-specs/send-approved-reply.md](task-specs/send-approved-reply.md) |
| T6 | Present and Verify Results | [task-specs/present-and-verify-results.md](task-specs/present-and-verify-results.md) |

T1 has two entry points: **Open & sort live inbox** retrieves the newest inbox window; **Reply** retrieves only the selected thread. H0 does not trigger either automatically. T6 presents progress throughout. Saved reply review returns to H2, and a requested redraft uses T4 with the saved context. H2's final **Confirm and send once** action is the only path to a new T5 send; an unknown send can use T5 for read-only reconciliation.
