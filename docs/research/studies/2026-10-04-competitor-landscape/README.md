# Competitor landscape

- Study start: 2026-10-04 UTC
- Evidence period: 2026-10-04 UTC / 2026-10-05 JST
- Status: Draft
- Documentation updated: 2026-10-05 UTC
- Predecessor: None — initial landscape study

The directory date identifies the original research start, not the latest edit. Follow the stable [research management guide](../../README.md).

## Question

What can the interaction models of personal AI assistants teach Orbit Nest before selecting its primary persona and first achievable job?

## Scope

Compare Dot, Muse, Grok Bot and ASIST using public material and limited prior ASIST v0.7.0 UI observations. Track Instinct as identity pending. Separate competitor facts, evaluation for Nest and proposed decisions. This is not an all-product execution benchmark or an instruction to implement new app behavior.

Individual writers and creators are an unvalidated primary-persona hypothesis. See the [repository README](../../../../README.md) for current Nest behavior; future concepts are explicitly identified in the comparison.

## Evidence and deliverables

- [Cross-product comparison](comparison.md): interaction, memory, scheduling, delegation, execution and partial cost comparison
- [Common use cases](use-cases.md): persona hypotheses and proposed synthetic journeys
- Product notes: [Dot](competitors/dot.md) / [Muse](competitors/muse.md) / [Grok Bot](competitors/grok-bot.md) / [ASIST](competitors/asist.md) / [Instinct](competitors/instinct.md)
- [Visual provenance](assets/README.md): public Marketplace quotation and original conceptual diagrams
- [Proposed decision 0001](../../../decisions/0001-research-before-persona-selection.md): research before persona selection

Public descriptions have been reviewed. ASIST observations come from a prior limited local evaluation; this study did not repeat that test. No participant interviews or common-scenario execution comparisons have been completed. Evidence grades and original observation dates are retained in the product notes.

## Provisional conclusions

- Conversation can be an entry point for ongoing work, but users still need a way to inspect progress, schedules and approval state.
- Internal task delegation and a user-managed Bot roster are different capabilities. Dot and Muse document delegation; Grok Bot provides documented role duplication and templates plus an observed public Marketplace.
- Reusing a role must not imply reusing learned memory or access scope. Shared computers and separate conversations are not the same security boundary.
- Persona, first-job and schedule-visibility hypotheses need common-journey validation before product adoption. See decision 0001, which remains PROPOSED.

These conclusions summarize the linked evidence and evaluation; they are not accepted product specifications.

## Unknowns and next evidence

Instinct identity; fuller plan, region and cost comparisons; installed-app UX beyond prior ASIST observations; routine execution under bounded failure conditions; and evidence for persona selection. Unconfirmed does not mean unsupported. The initial study remains a draft while these questions are open.

## Revision and correction record

- 2026-10-05: translated authored material into English for public readers. Observation dates and evidence status were preserved.
- 2026-10-05: moved the study into its start-date directory and decision 0001 into docs/decisions under the approved management convention. This is a documentation reorganization, not new product evidence or acceptance of the proposal.

No factual correction is asserted by these editorial changes. Future factual corrections must state their date, reason, affected claim and replacement evidence. Later reassessments use a new dated study linked here rather than overwrite a completed study.

## Follow-up

2026-10-06: [Moku daily-journey study](../2026-10-06-moku-first-life-bot/README.md) develops a candidate persona and first job. This link records a follow-up, not a factual correction or acceptance.
