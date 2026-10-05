# ASIST

Observed: 2026-10-04 UTC / 2026-10-05 JST. Prior local evaluation: v0.7.0 on macOS, 2026-10-04; not repeated in this research. The official README follows moving main, so distinguish it from fixed-version behavior. Evidence: documented plus prior hands-on observations.

## Facts

[A1] The README describes voice/text conversation, Cards, and Tasks / Agent jobs / Notes / Mail / Memory / Calendar mini apps. Users choose a conversation model; longer jobs require approval before handoff to a CLI. It distinguishes local storage from transmission to a model provider.

[H1] The prior evaluation observed ready/not-prepared stages in setup and separate Conversation, Tasks, Agent jobs and Memory views. These are UI observations, not scheduler verification.

## Evaluation

Purpose-oriented setup may help users reach a first useful result. The prior observer found the conversation area narrow and the distinction between Tasks / Agent jobs / Memory unclear. This is one observer's evaluation, not an established finding for the general user population.

## Sources and visuals

- A1: [Official repository README](https://github.com/nyosegawa/asist), checked 2026-10-04. [Official usage documentation](https://asist-agent.com/en/docs/usage/) could not be retrieved in this research and was not used as evidence.
- H1: Prior limited local evaluation; private captures are excluded from Git. Prefer A1 for publicly reproducible evidence.
- Refer to the README's Calendar / Agent jobs / Memory / Mail examples and official website. Images are not reproduced here; the [original conceptual diagram](../assets/concepts/interaction-models.svg) abstracts the interaction model.

## Open questions

The relationship between Tasks and Agent jobs, recurring schedules and next-run explanation, and memory scope. Verify these separately rather than infer backend behavior from UI.

## Version and limits

- A2: [ASIST v0.7.0 release](https://github.com/nyosegawa/asist/releases/tag/v0.7.0), released 2026-10-03; checked 2026-10-04. Matches the observed version.
- A3: [Model settings](https://asist-agent.com/en/docs/settings/models/), checked 2026-10-04; retrieval failed. A1 supports the statement about model-provider selection.

Task due dates were observed, but arbitrary user recurring jobs remain unconfirmed. Daily automatic memory curation is different from a user-scheduled recurring task. Approval for a CLI job is neither a safety guarantee for arbitrary operations nor universal undo. Record UI API-usage estimates, actual bills and CLI provider costs separately.
