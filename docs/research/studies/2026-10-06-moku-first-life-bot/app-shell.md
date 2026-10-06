# A calm desktop-app shell and labelled Dock

Revision: 2026-10-06 UTC. Proposed design only; not a runtime navigation implementation. The prior header/hero layout felt like a website. This revision uses a compact contextual title bar, a scrollable work pane and a persistent bottom-center Dock. Original designs remain in Git at `0f84ec3`.

| Dock destination | Meaning | Selected context |
| --- | --- | --- |
| Home | Active personal Bot roster, current work and next run | Home / Your Bots |
| Bots | Bot Library and selection; not a permission grant | Bots / Library or Bots / Moku |
| Tasks | Owner-labelled one-off work | Tasks |
| Recurring jobs | Owner-labelled recurring work, next due and pause | Recurring jobs |
| Plugins | App-shared connections with narrower Bot access | Plugins or Plugins / Personal inbox |

Bots opens Library/selection; a current Bot remains identifiable in the contextual title and its own heading. Home still selects existing personal instances. Plugins detail keeps Plugins selected. Settings is a compact labelled title-bar control, subordinate to daily work. Static Settings/task/action controls remain illustrative; Dock links switch actual concept pages.

## Layout and behavior hypothesis

The Dock sits in a dedicated grid row beneath the work pane, not as an overlay on conversation input or lists. The work pane scrolls independently; its bottom padding keeps the final control reachable. The shell is 100% of the viewport height. Desktop captures are 1440 × 1000; narrow captures are 390 × 1000. These are viewport screenshots with scrollable content, rather than tall website captures. Partly visible cards indicate more content; they are reachable by scrolling, not lost or hidden behind the Dock. A visible scrollbar makes that distinction clearer.

Every Dock destination has an original simple line icon plus a persistent label. One selected item has a filled surface, a small marker and `aria-current`; selection is not communicated by color alone. Links have a visible keyboard focus outline and at least a 68-pixel-high target. Narrow labels remain present, including two-line Recurring jobs; no hover is needed. Avoid magnification, bouncing, icon-only navigation and autoplay motion. There is no 3D interface. Actual native VoiceOver/keyboard navigation and screen-reader reading order still require future implementation QA.

The compact title bar uses decorative neutral circles to suggest desktop context; they are not functioning window controls. Headings and spacing are restrained rather than promotional. Content distinctions, approval/recovery states and Bot identities remain intact. The quieter surfaces do not change permission meaning, scheduled execution limits or durable status sources.

## Verification and manual validation

Rendered all seven screens at both widths and inspected actual pixels. Checked five Dock links, one active destination, visible focus outline, no horizontal document/pane/text overflow, and no pane/Dock geometric overlap. Scrolled every view to its final content; brought the conversation composer into view and verified its bottom stays above the Dock. Bot sidebar remains reachable via the narrow jump anchor. Dock selection and route labels remain visible through scrolling.

Proposed manual exercise: ask a reviewer to navigate Home → Bots → Moku, then find Tasks, Recurring jobs and Plugins without hovering; explain what Bots opens and where the current Bot name remains visible. At narrow width, focus the composer and reach Bot work without losing navigation. Record time, wrong routes and overlap complaints; no study has been completed. This is a visual-shell proposal, not acceptance of any earlier ADR.

## History

2026-10-06: replaced web-style top navigation/hero framing with a calm Dock and desktop app shell. [ADR 0005](../../../decisions/0005-desktop-dock-navigation.md) remains PROPOSED.
