# Common journeys and persona hypotheses

2026-10-04 UTC / 2026-10-05 JST. Proposed research protocol. Execution comparisons and user validation have not been performed.

## Personas to test

| Hypothesis | Problem to investigate | What needs validation |
| --- | --- | --- |
| Individual writer or creator | Wants to track manuscript changes and next revisions over time | Is repeated review needed, and does local manuscript access add value? |
| Individual researcher | Wants only meaningful changes from the same public sources | Expectations for notification frequency and source evidence |
| Person organizing everyday plans | Wants conversations connected to the state of plans and tasks | Are integrations essential, or can local capabilities provide useful value? |

Do not fix writers as the primary audience yet. Ask about a recent concrete task, existing alternatives, frequency and unacceptable failures. Stated interest alone is insufficient evidence for persona selection.

## Synthetic tasks

Use the same small fictional inputs. Exclude operations requiring real accounts, purchases or sending to others. Check each product's availability, costs and permissions before a separately authorized execution study.

| Journey | Common request | Observation and success criteria |
| --- | --- | --- |
| J1 First value | “Give me three improvements to this fictional manuscript.” | Obstacles between setup and the first evidence-backed result |
| J2 Recurring work | “Check this fictional information every day.” | One-off versus recurring work, next run, and sleep/quit behavior explained |
| J3 Review and stop | “What is running? Stop this job.” | Stop scope; waiting, failed and completed states distinguished |
| J4 Correct memory | “Forget this preference and do not pass it to another Bot.” | Understanding of editing, deletion, scope and approval |
| J5 Reuse a role | “Use the same editor for a different fictional manuscript.” | Confusion between blueprint and instance, memory and scope |

Record each journey as supported, limited, out of scope or unconfirmed. Do not force an out-of-scope operation. Record duration, assistance needed, output evidence and the state the participant can explain. Separate behavioral correctness from personal preference.

## Observation record

```text
Date and timezone / product / version / plan / platform / model:
Execution location / source scope / fixture hash:
Journey and synthetic fixture:
Evidence grade and source:
Prompt / observed steps / timestamps / public-safe screenshots / visible result:
Interventions / UI estimated usage / provider records / actual billing:
Limitations / untested behavior:
Participant interpretation (anonymized):
Researcher evaluation:
Implication and linked proposed decision:
```

UI impressions do not establish scheduler durability, memory isolation or execution safety. Keep regression checks for Nest's current behavior separate from competitor UX research.

## Three proposed end-to-end scenarios

| Scenario | Synthetic input and request | What to compare |
| --- | --- | --- |
| S1 Draft review | Small fictional draft and notes → read-only review, source gaps and three priorities | Uploaded copy versus selected folder; setup, permissions, evidence and quality |
| S2 Weekly follow-up | After a successful S1, “Summarize every Monday at 09:00 Asia/Tokyo.” | Owner, scope, timezone, next run, state, prior result, pause and edit |
| S3 Bounded review handoff | Fictional brief containing two unsupported claims → separate reviewer → reconciled result | Actual execution delegation versus roleplay; evidence, owner, cost and stop propagation |

**These scenarios have not been run.** Current Nest does not implement calendar/timezone recurrence or inter-Bot delegation. Record S2 as a gap between the requested calendar schedule and current intervals; treat S3 as future research. Do not implement features just to make the comparison possible. Sleep/quit/failure behavior in S2 needs a later bounded test. A successful Run now does not establish that a scheduled run succeeded.
