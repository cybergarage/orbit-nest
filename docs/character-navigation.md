# Character navigation and appearance

The bounded desktop implementation follows the approved gummy character direction
from [N06 multiple characters](https://www.figma.com/design/QN5kSb7QfmMJzi4w3sqPdf?node-id=39-404),
with the [desktop](https://www.figma.com/design/QN5kSb7QfmMJzi4w3sqPdf?node-id=28-155),
[narrow](https://www.figma.com/design/QN5kSb7QfmMJzi4w3sqPdf?node-id=28-227),
[appearance chooser](https://www.figma.com/design/QN5kSb7QfmMJzi4w3sqPdf?node-id=35-1280)
and [profile](https://www.figma.com/design/QN5kSb7QfmMJzi4w3sqPdf?node-id=10-107)
references. Design context and rendered references were inspected on 2026-11-16.
Example names, roles, conversations, messages and unread counts in Figma are not
seeded into user state. Existing Bots remain the identity and permission boundary.
This implementation does not accept the other broader research proposals.

## Using the workspace

The character rail selects an existing Bot. Its selected border, header and
composer identify the recipient by saved name. The adjacent conversation list
shows that Bot's Projects, Sessions and unseen result counts, including the
separate Legacy / unclassified conversation. The selected Project and Session
also appear in the header and immediately above Send. On narrow windows the rail
scrolls horizontally and Navigation expands above the conversation.

Home, Tasks, recurring jobs, Plugins, Bot creation, focus and existing work
controls remain available. Returning through the rail retains unsent drafts in
memory, separately for each Bot and Session. Project selection uses the existing
validated host command; during its acknowledgement, selection controls and new
submission controls are disabled. Work already accepted retains its captured
Bot/Project/Session. Pending or interrupted sends retain their original durable
receipt contract. An unconfirmed send opens its receipt panel when its own
conversation is displayed; it is never automatically resent.

Open **Projects & notes**, or **Project notes** in the selected character's work
panel, to create context and review/correct/deactivate Project notes. The existing
note guards, history and captured-context evidence remain authoritative. Switching
a conversation does not move notes, change membership, answer an approval or mark
any result read. Read receipts still require their explicit action.

## Appearance is separate from identity

Click the header character, the work-panel appearance button, or Change appearance
inside Model & profile settings. Mint, Peach, Sky, Lavender, Lemon and Rose are
previews for the same Bot. Cancel or Escape discards the preview; Apply color
persists only that Bot's appearance. Repeated Apply is safe because setting the
same value has no execution effects. The modal stays open with an error if the
host rejects the update. The native host validates the Bot ID and color allowlist.

Colors are stored in `work.json` application data under `botAppearance`, separate
from profiles, memory, model selection, work attempts and approval authority.
Missing/invalid saved colors display Mint. Existing Bots are not migrated or
renamed, and a color never implies a role or a different Bot. Profile revisions
are unchanged by appearance, so an outstanding approval remains bound to its
original request and an active model result is not invalidated by a cosmetic edit.
No source permission, model selection or execution API is added.

The current renderer route is remembered in local application browser storage;
unknown/stale routes fall back to Home. The selected Project/Session continues to
restore from the host's existing per-Bot state. Unsaved draft text is not promised
to survive a restart. Neither UI preference is an authorization credential.

## Design asset and visual qualification

`src/assets/gummy-characters.png` is the original 1536 × 1024 image supplied by
Figma design context, downloaded as instructed, not a screenshot of a screen.
Its SHA-256 is `9a9c00632fcf513b85c83da1bc002383b6029b243d0807c94e889994c2a4afa8`.
The shared avatar uses Figma's clipping geometry: image width 409.6%, height
301.18%, column offsets −21.33% / −156.09% / −290.85%, and row offsets −52.94% /
−183.65%. This preserves each color's supplied artwork, with no recoloring,
redrawing or temporary asset URL in runtime code. It is used in the rail,
recipient, character details, chooser, Bot cards and optional keepsakes.

The 48px rail, 56px desktop / 52px narrow recipient, 120px detail, and 144px / 88px
chooser avatar sizes follow the references. The narrow chooser reduces choices
to 64px to fit 390px windows. Existing semantic colors and native form/button
components are reused. The app retains its installed system rounded font rather
than downloading a font. Runtime work/approval/result controls replace Figma's
example text and unavailable preview actions; these remain inspectable, with
receipt detail below the composer. Synthetic desktop, narrow and chooser captures
are visually compared to the reference. This is a functional native adaptation,
not a claim of pixel-identical example content or a new usability study.

## Validation

Run `npm run lint`, `npm run typecheck`, `npm test`, and
`NEST_TEST_EVIDENCE_DIR=/tmp/nest-character-evidence npm run test:ui`, then
`npm run package`. For packaged UI set `NEST_PACKAGED` to the host package's
executable and run the character, approval-answer, conversation-input,
Project-context and Project-note Playwright suites. Evidence output can be kept
outside the checkout; never overwrite retained user screenshots for this work.

Synthetic runtime tests exercise appearance persistence, all six allowed values,
invalid/unknown inputs, repeated updates, unchanged profiles/active attempts and
approval tokens, and a delayed model response during Project/appearance switches.
Native UI tests exercise preview/cancel/Escape/repeated Apply, keyboard modal
focus, scoped drafts, unread results, navigation, notes, narrow overflow, repeated
sends with explicit recipients and restart. Existing unknown-outcome and approval
recovery suites continue to run. The synthetic delayed provider test is not
actual Apple/Ollama inference. Actual Apple inference remains opt-in and must be
reported separately if skipped. Remote clients, shared/delegated Bots, cloud
connections, per-conversation model selection (#8) and iOS remain out of scope.
