# Muse

Observed: 2026-10-04 UTC / 2026-10-05 JST. Product build unknown. Official introduction: September 2026. Evidence: announced for M1; documented technical description for M2. No hands-on product test.

## Facts

[M1] The introduction describes Main chat, side chats, personalization and persistent Memory. Activity and Goals show progress; Memory can be edited. It describes scheduled/event work and approval cards for consequential actions.

## Evaluation

A conversation-centered structure with places to inspect state, stop work and approve actions is useful comparison material for Nest. Whether first-time users understand it or find notifications intrusive remains untested. Successful examples in an introduction are not a general quality guarantee.

## Sources and visuals

- M1: [How We Designed Muse](https://introducing.muse.ai/), Mona Sarantakos with Christine Awad, September 2026; checked 2026-10-04.
- Refer to the official article's “Muse status and activity view,” “Muse goals and progress view” and “Muse checkout approval controls.” Reproduction permission has not been verified, so these visuals are linked rather than copied.
- [Conceptual comparison diagram](../assets/concepts/interaction-models.svg): original artwork, not actual UI.

## Open questions

Availability to the intended users, product version, notification controls in practice, correcting inaccurate memory and next-run visibility. Cloud execution descriptions must not be applied to Nest's local continuity guarantees.

## Execution and delegation

[M2] The technical article describes a dedicated cloud Linux VM, concurrent subagents and crons, and a separate Sentinel approval boundary. Internal subagents do not establish a user-managed multi-Bot library. Recovery and approval mechanisms do not imply universal rollback.

- M2: [How We Built Safety Into Muse](https://research.meta.ai/blog/security-and-safety-for-ai-agents-our-approach-with-muse), published 2026-09-08; checked 2026-10-04.
- M3: [Official subscription information](https://www.meta.com/help/subscriptions/1021145227643680/), checked 2026-10-04. Confirm current plan, region and allowance conditions before subscribing.

A reusable Bot roster and global Kanban remain unconfirmed. A local client does not imply local inference.
