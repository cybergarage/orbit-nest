# Daily journey: from intention to a return note

All dialogue is synthetic. Proposed interactions do not establish implemented behavior.

1. **Arrive.** Alex chooses the Moku instance on Nest Home (or adds a Moku preset from the Library). Moku's own conversation shows its work in a right sidebar. Alex: “I want to work on my manuscript.” Moku: “Which part would feel manageable today?” Alex: “The opening of section two.” Moku: “How about one transition into section two? You can change that.” The small step becomes an editable card, not a model-created completion claim.
2. **Begin.** Alex chooses 25 minutes and Start focus. Moku: “One transition into section two. I'll stay quiet.” A local timer starts without a source picker or a Preview ceremony. If Alex requests manuscript review, source scope and local-model availability must be validated; new access is explicitly selected and confirmed. Existing backend validation cannot disappear with the visible Preview screen.
3. **Quiet focus.** Show remaining time, task and Pause / Finish. No automatic nudges, model polling or celebratory interruptions. Changing the step is allowed. Finishing early is valid.
4. **Finish.** Timer reaches zero: “Time is up. What changed?” Alex: “I wrote a rough transition, but the opening still needs a pass.” Moku proposes: “Progress: rough transition drafted. Next: reread the opening of section two.” Alex edits and approves the exact note. Label progress **Reported by you**. The timer does not mark the manuscript or run completed.
5. **Return later.** Moku: “Your last note: reread the opening of section two. Start there?” Alex: “Yes, ten minutes.” The existing task returns to current work; avoid duplicate tasks on repeated clicks.

## Interruption and recovery

| Event | Honest dialogue and visible state | Action and durability requirement |
| --- | --- | --- |
| Phone interruption | “Paused at 12 minutes remaining. Leave a return note?” | Pause timer; save editable note only with confirmed persistence |
| Close window | “Nest is still running. The timer continues.” | Distinguish window close from Quit; no extra daemon |
| Quit / sleep / poweroff | On return: “This session ended while Nest was away. What actually happened?” | Proposed timer stores start/deadline and pause data; elapsed wall time may advance, but no productivity inference; ask on clock anomalies |
| Model unavailable | “I couldn't generate the suggestion. Your step is saved.” | Failed receipt, explicit retry after availability check; timer can remain usable independently |
| Late routine | “Due while Nest was stopped. One latest check-in is now due.” | Project Orbit's coalesced occurrence; no burst of missed reminders or claim that they ran |
| Interrupted model read | “The previous attempt was interrupted; checking recovery.” | Project actual run/attempt recovery, same request identity; do not invent completion |
| Unknown effect | “This action's outcome is unknown. Check before trying again.” | Keep recovery blocked; no automatic replay of uncertain effects |
| Cancel run | “Stop requested.” → “Cancelled” only after recorded cancellation | Local computation may continue briefly; cancelled output cannot become success |
| Pause routine | “Paused. No future runs until resumed.” | Already-created runs remain visible and separately cancellable |
| Forget return note | “Remove this note from Moku's memory?” | Exact local replacement approval; history retention is a separate question |
| External file save requested | “I can't write your manuscript here. You can copy the suggestion.” | Future external writes require a separately proven approval boundary |

A failed note save must say “Not saved” and retain the draft for retry; do not show a remembered state before storage confirms it. A restarted timer and a recovered Orbit run are different state machines. Their shared display must not become a second execution ledger.

## Multi-Bot revision

2026-10-06: the journey now begins at Nest's roster. Global Tasks and Recurring jobs are separate owner-labelled lists; selecting Moku scopes conversation and sidebar work to that instance. The timer and recovery boundaries above are unchanged.
