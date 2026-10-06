# 0006 — Warm desktop shell with left navigation

- Status: PROPOSED
- Date: 2026-10-06 (UTC)
- Acceptance date: None
- Acceptance evidence: None
- Implementation: Not started
- Supersedes: [0005](0005-desktop-dock-navigation.md), an unaccepted bottom-placement proposal
- Superseded by: None

## Context

The requested refinement moves the app-style Dock to the left and makes Nest cute, warm and companion-centered. Bottom placement must not remain simultaneously selected. Multi-Bot ownership, conversation and permission boundaries already constrain the design.

## Decision

Proposed: labelled left navigation on desktop, centered content/conversation and selected Bot's tasks/recurring jobs on the right. Narrow layouts use a keyboard-accessible collapsible navigation panel above a full-width work pane, with Bot work reachable below conversation. Compact route chrome and subordinate Settings remain. Use warm cream/peach/moss surfaces, rounded cards and original expressive 2D motifs while preserving readable status/ownership, useful density and contrast. No animation, copied branding or runtime change.

## Consequences

This replaces ADR 0005's bottom placement; ADRs 0001–0004 remain PROPOSED. Friendliness and navigation comprehension still require manual validation. Narrow expansion occupies vertical space without covering work; controls must remain reachable by scrolling. Shared Orbit durability, approval and plugin feasibility are unchanged. Theme selection is separately proposed in [0007](0007-theme-selection.md).

## Alternatives

| Option | Benefit | Limitation |
| --- | --- | --- |
| Warm left rail + narrow disclosure | Clear desktop work layout and companion identity | Narrow discovery and friendliness need testing |
| Bottom Dock | Persistent compact destinations | Earlier proposal, replaced by requested left placement |
| Austere icon-only rail | Compact | Weak character identity and hover dependence |

## Evidence

[Current app-shell rationale](../research/studies/2026-10-06-moku-first-life-bot/app-shell.md), [screens](../research/studies/2026-10-06-moku-first-life-bot/screens.md). Synthetic concepts and layout checks, not native implementation or completed user research.

## Record history

2026-10-06: proposed left-navigation/warm visual revision; bottom proposal retained as superseded, never accepted.
