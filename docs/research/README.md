# Research index and management guide

Keep research evidence, evaluation and product decisions separate. This is the stable entry point for Nest research; comparisons live in their owning studies, not in a second maintained copy at this level.

## Studies

| Study | Start date (UTC) | Status | Main question |
| --- | --- | --- | --- |
| [Moku first everyday-life Bot](studies/2026-10-06-moku-first-life-bot/README.md) | 2026-10-06 | Design proposal | Can a quiet companion help people begin and return to a small step? |
| [Competitor landscape](studies/2026-10-04-competitor-landscape/README.md) | 2026-10-04 | Draft | What can personal-assistant interaction models teach Nest before persona and first-job selection? |

See the [decision index](../decisions/README.md) for proposals and accepted decisions. Merging research does not accept product hypotheses.

## Layout

```text
docs/research/
  README.md
  studies/YYYY-MM-DD-short-title/
    README.md                 # Question, scope, period, conclusions, unknowns
    comparison.md             # Synthesis owned by this study
    use-cases.md               # Study-specific protocol, where useful
    competitors/              # Product evidence and evaluation
    assets/README.md           # Visual provenance
    assets/<product>/
    assets/concepts/
docs/decisions/
  README.md
  template.md
  NNNN-short-title.md
```

Create only the files a study needs. Create a product image directory only when suitable evidence is ready. Prefer Markdown, relative links and short tables organized by question.

## Study lifecycle

- Name each study using its original research start date in UTC. Keep that directory name as editing continues; observation dates may differ.
- During drafting, edit the study in place and use Git history rather than dated copies of every revision.
- Retain completed studies. A later reassessment gets a new dated study linked to its predecessor; link the follow-up from the predecessor too.
- Factual corrections include a correction date and reason, with the affected claim and replacement evidence. Do not silently turn an older observation into a current specification.
- Record the question, scope, research period, conclusions and unresolved questions in the study README. Mark conclusions as provisional when evidence is incomplete.
- Update product notes, then study synthesis, then any affected decision records. Avoid duplicate maintained comparisons until there is a distinct need.

## Evidence method

| Grade | Meaning | Limit |
| --- | --- | --- |
| hands-on | UI or behavior observed on an actual device | A screen does not establish implementation details or execution durability |
| documented | A statement in official documentation | The behavior has not necessarily been reproduced |
| announced | An official announcement or promotional demonstration | Availability to a particular user needs separate confirmation |
| observed public website | UI observed on an unsigned-in public website | Does not establish installed-app behavior or what happens after Add |
| unconfirmed | Product identity, source or behavior has not been verified | Does not mean unsupported |

Record observation dates, product versions (or unknown), source URLs and conditions. Attach source identifiers to factual claims and separate evaluation from facts. Distinguish documentation, actual tests and unknown behavior; do not call a proposed test completed. Aggregate scores are inappropriate until use cases and evidence are comparable.

## Public documentation and visuals

All authored research prose, tables, captions, diagrams and decision records are in English for public readers. Preserve original vendor UI labels and screenshots, with English explanations. Give every published image source/provenance, an observation date, conditions and publication context; label conceptual diagrams clearly.

Keep API keys, account email addresses, local paths, private conversations and user state out of public Git. Permission to inspect a capture is not permission to publish it. Public availability alone does not establish reproduction permission. See each study's asset register for its publication conditions.

## Decisions

Use [docs/decisions](../decisions/README.md) and its [template](../decisions/template.md). Each record has Status, Date, Context, Decision, Consequences and Evidence linking to the study. Add alternatives when useful. Record one meaningful decision per file; never reuse numbers. Superseding decisions use a new number and reciprocal links.

Product hypotheses remain PROPOSED until explicitly accepted. ACCEPTED means the decision was accepted, not implemented. A research PR merge does not change a decision's status. This documentation-management convention is approved; it does not approve the product proposals recorded in the studies.
