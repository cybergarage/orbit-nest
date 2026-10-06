# 0004 — Shared plugins with Bot-specific permissions

- Status: PROPOSED
- Date: 2026-10-06 (UTC)
- Acceptance date: None
- Acceptance evidence: None
- Implementation: Not started
- Supersedes: None

## Context

Multiple Bots may need the same account connection, while each role needs narrower capabilities. The requested design adds a Home-reachable plugin concept such as Gmail. Current Nest has no Gmail/OAuth/external-send capability; approval covers documentation/mockups only.

## Decision

Proposed: add a secondary Plugins destination with catalog/connections and detail/assignment views. Share an app-level connection among explicitly selected Bot instances. Separate provider OAuth consent, app-enforced per-Bot read/draft/send capability and exact per-action approval. Enforce identity, current grants, selected scope and approval at execution outside the model. Sending and external draft saving always require action review; schedules never send automatically.

Gmail, Calendar and Notes are illustrative contracts with unverified provider scopes and implementation feasibility. Reauthentication, unavailable or revoked access pauses affected jobs with Action required, no infinite retries, broadening or automatic replay. Reconnect/regrant/resume are separate user choices. Unknown external outcomes remain blocked; revocation cannot undo completed actions.

## Consequences

Connection reuse can simplify setup without erasing Bot boundaries. It needs a new proven external-operation/credential boundary and provider-specific feasibility research before implementation. Proposed 30-day minimal local plugin audit metadata excludes bodies/credentials; unresolved execution evidence needs a separately reviewed safe lifecycle. Shared execution durability remains in cybergarage/orbit. No actual OAuth, credential access, network permission or sending is authorized. [0001](0001-research-before-persona-selection.md), [0002](0002-moku-first-life-bot.md) and [0003](0003-multi-bot-navigation.md) remain PROPOSED.

## Alternatives

| Option | Benefit | Limitation |
| --- | --- | --- |
| Shared connection + per-Bot grants | Reuse with visible owner/capability boundaries | More enforcement and revocation design |
| Independent connection per Bot | Easy conceptual isolation | Repeated setup; provider identity still may be shared |
| Access for every Bot on connect | Fewer settings | Silent overbroad access; rejected for this proposal |

## Evidence

[Plugin study](../research/studies/2026-10-06-moku-first-life-bot/plugins.md), [screen specification](../research/studies/2026-10-06-moku-first-life-bot/screens.md). Synthetic design, not verified Gmail API capabilities or completed validation.

## Record history

2026-10-06: proposed plugin/permission architecture and static mockups; no acceptance or implementation.
