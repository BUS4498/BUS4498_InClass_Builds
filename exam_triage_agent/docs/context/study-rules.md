# Study rules

These rules are the static context for the application. Student-entered exam details and progress are dynamic context. The controller applies the calculations; a model may propose only the optional method comparison described in T4.

## Accepted inputs

- One exam name and a valid exam date that is today or later in the student's local calendar; exam format: **problem solving**, **written explanation**, or **mixed/multiple choice**.
- Available study minutes for the next sprint: a whole number from 15 to 60.
- One to six topics. Each has a nonblank name, importance **must know** or **other**, and self-rated confidence **1 = need practice**, **2 = partly ready**, or **3 = fairly ready**. An optional short difficulty note may explain the student's rating. Each topic starts **in the study queue**; the student may mark it **done reviewing for this exam** without claiming mastery. Ratings are student judgments, not measured mastery.
- A logged session records the topic ID, actual whole minutes from 0 to 180, a new confidence rating from 1 to 3, and the local date/time. Zero minutes is a valid log only when the student explicitly records that no study occurred; it must not change the topic's last-studied time or raise confidence automatically.

## Rank and explain

1. Rank unfinished topics only. For each, compute `review_priority = (4 - confidence) * importance_factor`, where the factor is 2 for **must know** and 1 for **other**. Higher values come first. This is a review-order index, not a prediction or a model probability.
2. Resolve ties by the topic studied least recently; never-studied topics precede studied topics. If still tied, preserve the student's entry order.
3. Display up to three top topics and show each topic's confidence, importance, calculation, last-studied status, and the reason for its position. Show any remaining topics below. When fewer than three qualify, show the actual number.
4. Recalculate when the student changes a rating/importance, adds or removes a topic, or logs a session. Keep the prior version identifiable in local history when needed to explain a change.

## Prepare one sprint

- Use the highest-ranked unfinished topic unless the student selects another. Allocate **2 minutes to set a goal**, `available_minutes - 5` minutes to study, and **3 minutes to self-check**. The three parts must sum to the student's chosen minutes.
- Default method by exam format: **practice problems** for problem solving; **teach back** for written explanation; **active recall** for mixed/multiple choice. The method is a study approach, not generated course content. Ask the student to use their own course materials.
- Show the exam date and days remaining as context. If the date is today, say so. Do not infer a grade, diagnose ability, invent course facts, or claim the student has completed a sprint before they log it.
- A model suggestion from T4 is separate until the student explicitly adopts its allowed method for the current saved sprint. Adoption requires the same context version and selected topic as the saved suggestion. Keep the exam-format default visible beside the adopted method and label the adopted method as the student's choice based on the named provider's suggestion. A changed input or selected topic creates a new default sprint; an earlier adoption does not carry forward automatically. A stale adoption leaves the prior sprint unchanged. Model confidence does not represent the student's knowledge. T4 and adoption cannot change the rank, time arithmetic, student rating, or saved progress.
