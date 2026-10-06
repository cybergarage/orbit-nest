# 0007 — Deferable Light, Dark and System themes

- Status: PROPOSED
- Date: 2026-10-06 (UTC)
- Acceptance date: None
- Acceptance evidence: None
- Implementation: Not started
- Supersedes: None

## Context

Theme selection is requested as a future preference; the current priority is the warm left-navigation layout. A full alternative theme set would unnecessarily expand this design pass.

## Decision

Proposed: offer Light, Dark and System in Settings after layout validation. Use semantic color tokens in concept sources now, preserving current light rendering. Future themes must keep owner/status meanings, contrast and focus visibility. System would follow OS preference only after explicit selection. This does not implement preference storage, OS detection or change any user settings.

## Consequences

Theme work can be deferred. Each future palette requires visual/accessibility QA, including approval and unknown states; decorative character colors are separate from state meaning. Current mockups stay light. [0006](0006-warm-left-navigation.md) defines the currently proposed shell, not approved implementation.

## Evidence

[Theme requirement in app-shell rationale](../research/studies/2026-10-06-moku-first-life-bot/app-shell.md#themes-planned-deferable), [screen specification](../research/studies/2026-10-06-moku-first-life-bot/screens.md). User-directed future design requirement; no implemented behavior or validated dark palette.

## Record history

2026-10-06: recorded theme choice as proposed/deferable; added semantic light tokens only.
