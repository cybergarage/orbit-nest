# Original concept assets

All assets were authored for this study on 2026-10-06 UTC. They are design proposals, not screenshots of implemented Nest behavior. The Moku sprout motif is an original inline SVG, not an external character asset or imagegen output. All tasks, dialogue and dates are synthetic. Publication is authorized for this public design study; no accounts, user state or private captures appear.

| Assets | Source and conditions |
| --- | --- |
| `concepts/01-home.html` | Editable standalone HTML/CSS and original inline SVG; character-centered Home and pending memory review |
| `concepts/02-focus.html` | Editable conversation and running timer concept |
| `concepts/03-today.html` | Editable task lanes, late and paused routines |
| `concepts/*-desktop.png` | Full-page Chrome headless renders, 1440 × 1000 viewport, scale 1 |
| `concepts/*-narrow.png` | Full-page Chrome headless renders, 390 × 1000 viewport, scale 1 |

## Reproduce

From the repository root, run `node docs/research/studies/2026-10-06-moku-first-life-bot/assets/render.cjs`. Uses the existing Playwright dependency and installed Chrome on macOS; `MOKU_BROWSER_PATH` can select another already-installed Chromium executable. No external resources or downloads are needed. PNG heights exceed the viewport where content scrolls. Buttons are inert; navigation links only switch concept pages.

## QA performed

2026-10-06: inspected actual pixels for all six renders. Main headline/action hierarchy, legible dark text, memory attention card, timer status and routine states are visible. Programmatic checks found no horizontal document overflow or overflowing text elements at either width. Primary white-on-moss contrast is approximately 7.6:1; muted ink on the darkest card background is approximately 4.8:1. Static checks do not establish assistive-technology or native interaction correctness.

Repository lint, types, 15 unit tests, five native UI tests and build passed on the canonical M4 checkout. The actual Apple model UI test was skipped because it is opt-in. No live model or user-study success is asserted. Git diff and relative Markdown links were checked before delivery.
