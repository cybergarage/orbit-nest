# 0005 — Desktop-app shell with a labelled Dock

- Status: SUPERSEDED
- Date: 2026-10-06 (UTC)
- Acceptance date: None
- Acceptance evidence: None
- Implementation: Not started
- Supersedes: None
- Superseded by: [0006](0006-warm-left-navigation.md)

## Context

The multi-Bot concepts' top-right web navigation and large hero framing felt like a website. The requested design refinement is a calm desktop-app navigation model while keeping Bot, task, recurring-job and plugin boundaries clear.

## Decision

Historical, unaccepted proposal: compact contextual title chrome, an independently scrolling workspace and a persistent bottom-center Dock with icons plus labels for Home, Bots, Tasks, Recurring jobs and Plugins. Bots opens Library/selection; Moku detail keeps Bots selected and names its context. Settings remains a secondary labelled title-bar control. Dock selected state and focus are visible without hover; no magnification, bouncing or 3D.

Reserve a dedicated Dock row so navigation cannot overlay conversation input or list actions. Narrow layouts keep all five labels and scroll content above the Dock. These are isolated static concepts only; existing ADRs 0001–0004 remain PROPOSED and no runtime feature is approved.

## Consequences

Daily work may feel more native and less promotional. Long content must remain discoverable by independent scrolling; icon/label semantics and keyboard/native accessibility require manual validation and future implementation QA. Dock navigation does not change shared Orbit durability, approval boundaries, app-running-only schedules or plugin feasibility.

## Alternatives

| Option | Benefit | Limitation |
| --- | --- | --- |
| Labelled bottom Dock | Persistent compact app navigation | Needs a dedicated safe area and narrow layout |
| Top web-style links | Familiar to browser users | Weak desktop-app identity in prior concepts |
| Icon-only or animated Dock | Compact or expressive | Hover dependence and distraction; not proposed |

## Evidence

[App-shell rationale](../research/studies/2026-10-06-moku-first-life-bot/app-shell.md), [screens](../research/studies/2026-10-06-moku-first-life-bot/screens.md). Synthetic visual QA and design direction, not a completed user study or native implementation.

## Record history

2026-10-06: proposed desktop-shell/Dock revision, retaining previous design in Git at `0f84ec3`. No acceptance or implementation.

2026-10-06: superseded by [0006](0006-warm-left-navigation.md) after the requested left-navigation revision. Bottom placement is no longer the current proposal. This status records replacement of a proposal, not acceptance or implementation.
