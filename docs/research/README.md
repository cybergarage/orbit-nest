# Competitor research

Research notes that keep competitor facts, evaluations for Nest and decision records separate. **Initial draft: 2026-10-04 UTC / 2026-10-05 JST. Product decisions remain pending.**

**Language convention:** write all authored research prose, tables, captions, diagrams and decision records in English for public readers. Preserve original vendor UI labels and screenshots, and explain them in English.

## Start here

- [Cross-product comparison](comparison.md): features, UX and unresolved questions
- [Common use cases](use-cases.md): persona hypotheses and a consistent observation protocol
- Product notes: [Dot](competitors/dot.md) / [Muse](competitors/muse.md) / [Grok Bot](competitors/grok-bot.md) / [ASIST](competitors/asist.md) / [Instinct](competitors/instinct.md)
- [Visual provenance and publication conditions](assets/README.md)
- [Decision records](decisions/README.md): distinguish proposals, acceptance and deferral

## Repository structure

```text
docs/research/
  README.md                   # Index, method, current status
  comparison.md               # Cross-product synthesis
  use-cases.md                # Comparable journeys and persona hypotheses
  competitors/<product>.md    # Facts, evaluation, sources, open questions
  assets/README.md            # Provenance and publication conditions
  assets/<product>/           # Only reviewed, publishable visual evidence
  assets/concepts/            # Original diagrams, never product screenshots
  decisions/README.md         # Decision index
  decisions/template.md       # Small reusable record
  decisions/0001-*.md          # Proposed or explicitly accepted decisions
```

Create a product image directory only when a suitable image is ready to publish. Use Markdown and relative links; prefer several short tables organized by question over one very wide comparison table.

## Evidence method

| Grade | Meaning | Limit |
| --- | --- | --- |
| hands-on | UI or behavior observed on an actual device | A screen does not establish implementation details or execution durability |
| documented | A statement in official documentation | The behavior has not necessarily been reproduced |
| announced | An official announcement or promotional demonstration | Availability to a particular user needs separate confirmation |
| observed public website | UI observed on an unsigned-in public website | Does not establish installed-app behavior or what happens after Add |
| unconfirmed | Product identity, source or behavior has not been verified | Does not mean unsupported |

Record the observation date, product version (or unknown), source URL and conditions in each product note. Attach source identifiers to factual claims and put evaluation in a separate section. Correct earlier observations with dated updates rather than silently treating them as current specifications. Update product notes, then the comparison, then affected decision records.

Do not assign aggregate scores yet. Adding together different evidence grades and use cases would not produce a fair ranking.

## Current status

Public material for Dot, Muse, Grok Bot and ASIST has been reviewed. ASIST v0.7.0 observations come from a prior limited local evaluation; this research did not repeat that test. Instinct identity remains pending. No participant interviews or common-scenario execution benchmark have been completed.

Individual writers and creators are an unvalidated primary-persona hypothesis for Nest. This research examines the existing prototype before selecting a persona or implementing further UX changes. See the [repository README](../../README.md) for current behavior; the comparison explicitly separates future concepts from current capabilities.

Keep API keys, account email addresses, local paths, private conversations and user state out of public Git. Permission to inspect a capture is not permission to publish it. Next evidence needed: fuller availability and cost comparisons, the intended Instinct product URL, and evidence for persona selection.
