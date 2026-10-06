# Original concept assets

All assets were authored and revised for this study on 2026-10-06 UTC. They are design proposals, not screenshots of implemented Nest behavior. The Moku sprout, Luma owl and Pip bookmark-fox motifs are original inline SVGs, not an external character asset or imagegen output. All tasks, dialogue and dates are synthetic. Publication is authorized for this public design study; no accounts, user state or private captures appear.

| Assets | Source and conditions |
| --- | --- |
| `concepts/01-home.html` | Editable standalone HTML/CSS and original inline SVG; multi-Bot Home and pending memory review |
| `concepts/02-focus.html` | Editable Moku conversation/timer with right-side owned work |
| `concepts/03-today.html` | Editable owner-labelled task list |
| `concepts/04-library.html` | Library presets, role preview and bounded customization concepts |
| `concepts/05-routines.html` | Separate owner-labelled recurring list, next due and paused/late states |
| `concepts/06-plugins.html` | Shared connection/catalog fixture, synthetic aliases and unavailable/revoked states |
| `concepts/07-plugin-detail.html` | Illustrative Gmail assignment, operation-review and privacy/revocation detail |
| `concepts/*-desktop.png` | Chrome headless app-shell viewport renders, 1440 × 1000, scale 1 |
| `concepts/*-narrow.png` | Chrome headless app-shell viewport renders, 390 × 1000, scale 1 |

## Reproduce

From the repository root, run `node docs/research/studies/2026-10-06-moku-first-life-bot/assets/render.cjs`. Uses the existing Playwright dependency and installed Chrome on macOS; `MOKU_BROWSER_PATH` can select another already-installed Chromium executable. No external resources or downloads are needed. The Dock revision captures the viewport shell; long content scrolls independently in the work pane. Previous tall screenshots remain in Git history. Buttons and filters are inert; navigation links switch concept pages and the narrow Bot-work anchor reaches its labelled sidebar.

## QA performed

2026-10-06: inspected actual pixels for all ten revised renders. Main headline/action hierarchy, legible dark text, Bot identity/ownership, memory attention card, timer status and routine states are visible. Programmatic checks found no horizontal document overflow or overflowing text elements at either width. Primary white-on-moss contrast is approximately 7.6:1; muted ink on the darkest card background is approximately 4.8:1. Static checks do not establish assistive-technology or native interaction correctness.

Repository lint, types, 15 unit tests, five native UI tests and build passed on the canonical M4 checkout. The actual Apple model UI test was skipped because it is opt-in. No live model or user-study success is asserted. Git diff and relative Markdown links were checked before delivery.

## Revision provenance

2026-10-06: original three-screen version remains in Git at `99f7e15`. Revised Home, Moku and Tasks PNGs replace their corresponding concepts; Library and Recurring jobs are new views. Ten actual revised renders were inspected at desktop/narrow widths; no horizontal/text overflow was found. Additional named Bots remain illustrations rather than product commitments. Library versions preserve the three original published screen identities.

2026-10-06, plugin revision: Home adds Plugins navigation; Plugins and Plugin access add four rendered desktop/narrow PNGs. Gmail initial letter is a neutral original typographic mark, not a copied logo. All aliases use synthetic data; no provider UI, account information, OAuth scopes or credential captures. Inspected Home and both new screens at both widths; no clipped text or horizontal overflow. Open disclosure states are also checked visually; actual permission/accessibility enforcement is unimplemented.

Plugin QA: Home → Plugins → Manage access navigation succeeded at both widths. Both disclosures opened with keyboard Enter; open-state text/viewport overflow checks passed. Required repository checks passed again (15 unit, five native UI; opt-in Apple live UI skipped).

2026-10-06, Dock revision: all fourteen images rerendered as app-shell viewport captures. Original Dock line icons are inline SVG; decorative title-bar dots are not actual OS controls. Desktop/narrow pixels and scrolled-bottom states were inspected. Five labelled links, one `aria-current`, focus outlines, pane/Dock separation and composer safe area passed programmatic checks. All seven Library image identities are replaced in-place; no duplicate items.
