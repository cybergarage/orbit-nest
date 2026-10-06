# Multi-Bot concept screens

Static editable designs, not runtime UI. Five states are rendered at desktop 1440 × 1000 and narrow 390 × 1000 viewports with full-page capture. Every screen carries a concept label. Controls are inert except navigation links and the narrow sidebar jump anchor.

| Screen / source | Primary hierarchy | States and details |
| --- | --- | --- |
| [Home](assets/concepts/01-home.html) | Active Bot roster → actual current work → next recurring run | Three characters/roles, one model run, one memory review, two enabled routines, Add Bot |
| [Individual Moku](assets/concepts/02-focus.html) | Conversation and timer → right sidebar | Current task, recurring job and next due, memory review entry; narrow jump link to stacked work |
| [Tasks](assets/concepts/03-today.html) | Owner-labelled one-off list | Bot filter; paused session, running read, approval required, unknown/recovery |
| [Bot Library](assets/concepts/04-library.html) | Presets → role preview → Add | Moku candidate, illustrative Luma/Pip, bounded customization and custom blueprint concept |
| [Recurring jobs](assets/concepts/05-routines.html) | Separate owner-labelled recurring list | Interval, next due, enabled/paused, late occurrence; Bot filter |

See [structure and boundaries](structure.md) for roster/blueprint distinctions. Home, tasks and Bot-local views depict different moments of a synthetic day, not synchronized live state. Moku's timer is not a running model task.

## Interaction contract

Start focus starts only a local timer proposal. Selected-manuscript review retains exact source/model validation; new permissions and consequential actions cannot hide inside an ordinary Start. Memory review displays the exact replacement before saving. Unknown outcomes expose Recover and block automatic replay; failed drafts remain retryable. Disable duplicate Add/dispatch while pending. Filters and task buttons demonstrate interaction destinations but do not execute.

A role can be customized without granting unrestricted tools. Add creates an isolated instance; save-to-Library keeps private memory and source access out of the blueprint. Task and recurring tabs are separate views, not kanban lanes. Every global row keeps owner identity. Model output is not proof of external completion; user-reported progress is distinctly labelled.

## Visual and accessibility direction

Warm paper, dark ink and restrained moss actions persist. Three original 2D motifs make roles identifiable without 3D rooms; names and textual state accompany every character. Settings move out of the primary work area. Native fonts avoid downloads; controls are at least 44 pixels tall with visible focus outlines. Narrow screens stack cards/rows, repeat owner labels and expose an anchor to Bot-local sidebar content. Production still needs full keyboard, assistive-technology and native-interaction QA.

## Revision history

2026-10-06: initial three-screen Moku-centered design preserved in Git at `99f7e15`.
2026-10-06: revised to the clarified multi-Bot hierarchy, right sidebar and separate task/recurring lists. No runtime implementation or acceptance.
