# 0008 — Optional, no-loss nurturing for Moku

- Status: PROPOSED
- Date: 2026-10-06 (UTC)
- Acceptance date: None
- Acceptance evidence: None
- Implementation: Not started
- Supersedes: None

## Context

Moku should feel like a character with a home, while helping users start and return to small work. A pet-care loop could instead add pressure, distraction or misleading completion signals.

## Decision

Proposed: test optional Moku-only nurturing through three expressive states and three home decorations. Cap acknowledgements at one explicit start and one reflection/deliberate stop per day. Breaks preserve all possessions; no neglect punishment, sickness/death, streak loss, hour-based rewards or spending. Rest quietly during focus. Use idempotent local event records; rewards never verify task completion or rewrite run receipts.

## Consequences

May improve perceived companionship, but efficacy is unknown. Adds local-state and accessibility work, with calendar-cap handling unresolved. Start with one-week self-use comparing enabled and hidden days; simplify if distracting or guilt-inducing. The current illustration is temporary. Other Bots need not nurture anything. No scheduler, background execution or runtime changes are approved.

## Alternatives

Expressions only; a return-note garden without rewards; no nurturing. Each remains available pending validation.

## Evidence

[Nurturing proposal and validation](../research/studies/2026-10-06-moku-first-life-bot/nurturing.md), [character provenance](../research/studies/2026-10-06-moku-first-life-bot/assets/README.md). User-directed design exploration, not proven gamification benefit.
