# Three concept screens

These are static, editable design concepts, not runtime UI. Buttons illustrate states and are intentionally inert. Desktop viewports are 1440 × 1000, captured full-page; narrow renders are 390 pixels wide with full-page capture. Every screen carries a concept label.

| Screen | Primary hierarchy | Secondary information and states |
| --- | --- | --- |
| Home | Moku → remembered next step → Start focus | Reported progress, remember-note review, capability boundary; settings stays in nav |
| Conversation + focus | Small-step dialogue beside quiet timer | Running timer, Pause / Finish, saved current step, permission review entry |
| Today | Three task lanes and two routines | Counts, next due time, paused state, late occurrence and receipt wording |

## Interaction contract

Start focus starts only the local timer proposal. “Read selected manuscripts” has a separate scope review with exact files, read-only limits and model availability. A newly requested grant or consequential operation never becomes an ordinary Start action. Show persistent memory approval as a distinct card; the home screenshot demonstrates this pending state. Disable repeated dispatch while pending and retain failed drafts.

Today separates task intent (Ready / Current / Reported done) from execution receipts (Failed / Cancelled / Unknown / approval required). A task may be reported done even if no model run happened. A successful model receipt establishes generated output, not a completed manuscript. Routine cards show active/paused count and local next due; Pause affects future scheduling, not already-running work. Proposed kanban membership reflects conversation outcomes, not a new shared scheduler.

## Visual and accessibility direction

Warm paper background, dark ink, moss primary action and restrained amber for attention. One rounded seed character is repeated as recognition, with explicit labels for its state. Large task headline, spacious cards and compact secondary navigation reduce settings density. Native platform fonts avoid downloads. Keyboard focus has a visible outline; buttons are at least 44 pixels tall. Text is never conveyed solely by color. Narrow layouts stack conversation and timer, wrap navigation and task lanes, and scroll vertically. No 3D interface.

A production implementation would still require keyboard/screen-reader behavior, native Electron testing and an accessibility review. Static render QA cannot establish those behaviors. Timer persistence, structured notes, Moku identity and all layouts remain proposed.
