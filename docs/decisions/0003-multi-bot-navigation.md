# 0003 — Multi-Bot roster, Library and owned-work lists

- Status: PROPOSED
- Date: 2026-10-06 (UTC)
- Acceptance date: None
- Acceptance evidence: None
- Implementation: Not started
- Supersedes: None

## Context

The clarified design direction places Moku among Library Bots. A single-character app Home and kanban-only global work view do not clearly support choosing between Bots or identifying ownership. Approval covers revising documentation/mockups, not runtime changes or acceptance of product hypotheses.

## Decision

Proposed: Nest Home shows active Bot cards with character/name/role, actual current work, next scheduled run, Add Bot and compact active/attention counts. A Library offers role presets and bounded customization. Each Bot has a conversation-first view with its own tasks and recurring jobs on the right. Global Tasks and Recurring jobs are separate owner-labelled lists with Bot filters; recurring rows expose interval, next due and enabled/paused state.

Moku remains the candidate focus Bot in [0002](0002-moku-first-life-bot.md). Luma and Pip are illustrative roles only. [0001](0001-research-before-persona-selection.md) remains PROPOSED. This record does not supersede or accept either proposal.

## Consequences

Ownership and navigation become explicit across multiple Bots. Library blueprints and personal instances require a clear boundary: private memory, conversation and source grants must not transfer through a blueprint. Sidebar information must remain reachable on narrow screens. Counts, task statuses and next-run display project actual shared Orbit records, without another execution ledger. A focus timer is distinct from a model run; approved memory and unknown-outcome recovery remain explicit. App-running-only schedules and external-write boundaries remain constraints.

## Alternatives

| Option | Benefit | Limitation |
| --- | --- | --- |
| Multi-Bot roster and separate lists | Clear owner and schedule visibility | More navigation to explain and validate |
| Single Moku-centric Home | Focused first session | Misrepresents the clarified multi-Bot direction |
| Kanban-only work | Spatial task grouping | Recurrence and owner details need more room |

## Evidence

[Structure rationale](../research/studies/2026-10-06-moku-first-life-bot/structure.md), [revised screens](../research/studies/2026-10-06-moku-first-life-bot/screens.md) and [validation protocol](../research/studies/2026-10-06-moku-first-life-bot/validation.md). Synthetic design synthesis; no completed user study or new competitor facts.

## Record history

2026-10-06: proposed multi-Bot structure after design-direction clarification. No acceptance or implementation.
