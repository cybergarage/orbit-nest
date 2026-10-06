# Current proposal: warm desktop shell with left navigation

Revision: 2026-10-06 UTC. Design only. This left-placement proposal replaces the bottom Dock proposal; it is not a second simultaneously selected navigation system. [ADR 0005](../../../decisions/0005-desktop-dock-navigation.md) is SUPERSEDED as an unaccepted proposal by [ADR 0006](../../../decisions/0006-warm-left-navigation.md), which remains PROPOSED. No runtime feature is implemented or accepted.

## Navigation and work layout

| Destination | Meaning | Context retained |
| --- | --- | --- |
| Home | Active personal Bot roster, actual current work and next run | Home / Your Bots |
| Bots | Library and selection; not a permission grant | Bots / Library or Bots / Moku |
| Tasks | Owner-labelled one-off work | Tasks |
| Recurring jobs | Owner-labelled recurring work, next due and pause | Recurring jobs |
| Plugins | Shared connections with narrower Bot access | Plugins / Personal inbox when inspecting access |

At desktop, the left rail shows original rounded line icons and short labels. Main content/conversation is centered; selected-Bot current/recurring jobs remain on the right. A compact contextual title stays above the whole workspace, and Settings remains discoverable in that chrome. There is no bottom Dock or reserved bottom-navigation gap. Moku remains one Bot, not the app identity.

At narrow width, navigation starts collapsed into a labelled native disclosure. Keyboard Enter/Space expands the five labelled destinations in a full-width panel above the workspace, then collapses it again. This pushes content down instead of covering it or reducing its horizontal width. The title continues to identify the route; the selected link has a background, side marker and `aria-current`. Right-side Bot work stacks below the conversation, reachable through its jump anchor. Inputs/actions remain full width. This is an original pattern, not a copy of competitor assets.

## Cute, calm and readable

Nest should feel like a small place where companions live. The revised palette uses warm cream/peach surfaces, soft moss selection, rounded cards and original sprout/owl/fox motifs with gentle cheek details. Home foregrounds characters and welcomes the next small step. Navigation icons share the same rounded stroke language. Avoid austere control-panel styling, promotional hero framing, childlike labels, distracting animation, magnification or 3D. Names, status text and owner labels remain legible; decoration never replaces evidence or an approval warning.

The roster characters have more visual presence; dense task rows retain compact owner avatars. Approval/unknown/paused states keep textual distinctions and contrast. The composer and right-side jobs remain useful for adult everyday work. This visual revision does not expand tool permissions, change receipt semantics or promise execution while Nest is stopped.

## Themes: planned, deferable

Light, Dark and System selection belongs in Settings and can follow layout validation. This pass renders only the light palette. Editable CSS uses semantic variables for ink, muted text, workspace, chrome, surface, selected state, accent, focus and attention. Character artwork colors are independent of permission meaning. A Settings title describes the future appearance choices; it is not a functioning preference. No OS theme detection, persistence or user settings were changed. [Theme proposal](../../../decisions/0007-theme-selection.md) remains PROPOSED; contrast and status meanings need verification for each future theme.

## Verification and manual validation

Captured all seven screens at 1440 × 1000 and 390 × 1000. Narrow expanded-navigation and scrolled-content evidence is also stored alongside the editable sources. Reproducible checks verify five links, one selected destination, keyboard expansion/collapse, visible link focus, no horizontal text/document/pane overflow and geometric separation between navigation and work. Composer bounds remain inside the safe work pane after scrolling. Actual pixels are inspected for roster warmth, right-job visibility, narrow labels and reachable final actions. Native VoiceOver and runtime interaction tests remain future work.

Proposed manual exercise: find Home, Library/selection, Tasks, Recurring jobs and Plugins without hovering; locate current Moku context, composer and owned jobs at both widths. Ask whether the character treatment feels friendly without obscuring work. Record time/errors and wrong ownership/approval interpretations. Theme choice should be findable in Settings once implemented. No user study is claimed.

## Revision trail

- 2026-10-06: compact app chrome and bottom Dock proposal at `ac9bd47`, retained in Git; never accepted.
- 2026-10-06: revised to left navigation, narrow disclosure and center/right work layout; supersedes bottom placement only.
- 2026-10-06: added warm/cute original motifs and recorded deferred Light/Dark/System requirement with semantic palette tokens. No implementation or preference writes.
