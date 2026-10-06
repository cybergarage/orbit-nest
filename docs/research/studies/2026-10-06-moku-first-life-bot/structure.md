# Nest structure: a library, a roster and Bot-owned work

Revision date: 2026-10-06 UTC. Design-only response to clarified multi-Bot product direction. Moku is a candidate library Bot, not the product identity. Additional named Bots are synthetic illustrations of ownership, not independently accepted products.

| Destination | Question answered | Essential content |
| --- | --- | --- |
| Home | Which Bot should I return to? | Character, name, role, current actual work, next recurring run, Add Bot, compact active/attention counts |
| Bot Library | Which role should I add? | Preset choices, role preview, bounded customization, add as a separate instance; save a custom blueprint concept |
| Individual Bot | What are we discussing and doing? | Conversation as main column; that Bot's current tasks and recurring jobs in right sidebar |
| Tasks | Who owns this one-off work, and what state is it in? | Separate task list, owner avatar/name on every row, state, receipt/recovery action, owner filter |
| Recurring jobs | Who will do what next, and is it enabled? | Separate recurring list, owner every row, interval, next due, enabled/paused, late occurrence, owner filter |
| Plugins | Which shared connection is ready, and which Bots may use it? | Connection status/account alias, catalog, per-Bot capabilities and operation approval |

## Home and Bot identity

The active roster is composed of personal instances, distinct from Library blueprints. Moku's focus timer is not counted as an active model run. The Home fixture has three Bots, one running model task, one pending memory review, and two enabled routines. Its counts summarize synthetic durable states; production must derive them from real records, not model prose. Click a Bot to enter its own context; Add Bot goes to the Library. Settings stay secondary.

Moku remains the focus candidate. Luma illustrates the existing bounded selected-writing review role. Pip illustrates local editable return-note/memory work. Luma and Pip motifs are original 2D drawings, and their named presets remain conceptual. These illustrations do not introduce browsing, external writes, independent autonomy or a commitment to ship three products.

## Library and customization

Preview a role before Add. Proposed customization covers name, tone and bounded role. Adding instantiates separate conversation, memory and scope; a role description cannot grant tools. Source grants must be explicitly selected per instance rather than copied from a blueprint. Saving to the Library stores only a reusable role configuration, never private memory, conversation, manuscript text or source paths. Sharing a blueprint is outside this design. Existing provider readiness checks still apply; no model download or fallback.

## Individual Bot and narrow screens

Conversation remains the primary surface, with a right sidebar for the selected Bot's current tasks and recurring jobs. Moku's quiet timer stays with the conversation, not in the global active-run count. Sidebar cards show task state, recurrence, next due and pause action without navigating to settings. On narrow screens, a keyboard-focusable “Jump to Moku's tasks & recurring jobs” anchor reaches the stacked labelled sidebar. Cards retain Bot context; the global lists repeat owner identity in every row. The static anchor works; task controls and filters only illustrate future interactions.

## Lists and honest states

Tasks and recurring jobs have separate tabs/views, not a combined kanban. Each row repeats owner name and distinctive avatar; color alone never identifies ownership. Task status preserves approval-required, running, cancelled, failed and unknown outcomes. The task mockup shows paused human focus, running model read, unapproved memory and unknown/interrupted work. “Reported done” would remain a user report distinct from a successful model receipt.

Recurring rows show elapsed interval, next due and enabled/paused state. The late fixture has one latest missed occurrence, not a queue of every missed interval. Enabled does not mean guaranteed execution. Window close leaves Nest running; Quit/sleep/poweroff prevent execution. Pause affects future scheduling, and Cancel/Request stop targets an already-created run. Unknown effects retain blocked replay. The lists project shared Orbit records; they must not become a second execution ledger.

## Why the revision

The initial Home overemphasized one character as Nest's identity, and the kanban made cross-Bot ownership less explicit. The clarified direction calls for Library selection, multiple active Bots, Bot-local right-side work and separate global lists. Git retains the earlier concepts at `99f7e15`; the study keeps its original UTC date. No product hypothesis or ADR is silently accepted.

## Shared-plugin revision (2026-10-06)

Home adds a secondary Plugins destination. Connections belong to the app; capability grants belong to individual Bots. The Library grants no plugin access. [Plugin design](plugins.md) separates provider consent, Bot permission and action approval and explains dependency/revocation states. Gmail and additional adapters remain illustrative future contracts.
