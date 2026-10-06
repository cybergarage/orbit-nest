# Decision records

Keep proposals distinct from accepted decisions and implementation status. Research evidence lives in [dated studies](../research/README.md).

| Record | Status | Date | Question |
| --- | --- | --- | --- |
| [0001](0001-research-before-persona-selection.md) | PROPOSED | 2026-10-04 | Should primary-persona and first-job selection follow use-case research? |
| [0002](0002-moku-first-life-bot.md) | PROPOSED | 2026-10-06 | Should Moku be validated as the first everyday-life Bot? |
| [0003](0003-multi-bot-navigation.md) | PROPOSED | 2026-10-06 | How should a multi-Bot roster, Library and owned work connect? |
| [0004](0004-shared-plugins-bot-permissions.md) | PROPOSED | 2026-10-06 | How can shared plugins preserve Bot-specific access and action approval? |
| [0005](0005-desktop-dock-navigation.md) | SUPERSEDED | 2026-10-06 | Should a labelled Dock and dedicated work pane define the app shell? |
| [0006](0006-warm-left-navigation.md) | PROPOSED | 2026-10-06 | Should a warm left rail replace the bottom Dock proposal? |
| [0007](0007-theme-selection.md) | PROPOSED | 2026-10-06 | Should Light/Dark/System themes be added after layout validation? |

| [0008](0008-moku-optional-nurturing.md) | PROPOSED | 2026-10-06 | Can optional no-loss nurturing support small starts and returns? |

## Record convention

Copy the [template](template.md) and assign a new sequence number and short title: NNNN-short-title.md. Never reuse a number, including numbers from rejected or superseded records. Keep one meaningful decision per record.

Required fields: Status, Date, Context, Decision, Consequences and Evidence. Evidence links to the relevant study and distinguishes observed facts from evaluation. Add alternatives where they clarify a tradeoff. Date is the initial record date in UTC; track later changes separately.

Statuses: PROPOSED / ACCEPTED / DEFERRED / REJECTED / SUPERSEDED. Without explicit acceptance, product hypotheses remain PROPOSED. ACCEPTED requires acceptance date and evidence, and does not mean implemented. Merging a research PR does not accept its proposals. Do not publish private personal details or conversations as approval evidence.

A superseding decision receives a new number. Link the old record's replacement and the new record's predecessor so both directions are traceable; retain the earlier reasoning. Implementation status, when useful, is tracked separately from decision status.
