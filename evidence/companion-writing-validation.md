# M4 Companion and writing validation

Environment: secondary mac-mini-m4, arm64, local installed Ollama gemma4:12b. Synthetic fixtures only.

- Corrected screenshot was inspected locally. Ollama showed ready. Both weather questions had been routed to source summaries without selected sources; initial missing grants were inaccurately described as revoked. Local chat is now separate, live-weather capability is explained, and source preflight provides settings guidance before enqueue.
- Local lint, TypeScript, five unit tests and two native plus two packaged Electron UI tests pass.
- Unit checks cover exact model instruction binding, Companion/history isolation, stale profile rejection, stable retry IDs, successful-only baseline projection, failed-capture exclusion, traversal/symlink rejection, missing files, truncation, source-revocation cancellation and stale-memory protection.
- Actual local gemma4:12b produced first and changed Markdown/AsciiDoc manuscript reviews across a runtime restart. Repeating the same changed-review request retained two total visible results. See writing-live.json.
- Scheduled manuscript execution was SIGKILLed after capture during inference. Restart recovered queued work, retained its request ID and recorded one visible result across two attempts. The interrupted capture did not become a baseline. See crash-live.json.
- Persistent memory approval and window-close/reopen behavior pass the native and packaged UI suite. Source-mode routine payload and explicit file selection are checked without running a real model in CI.
- Pinned archive and installed core provenance verification pass. Shared core is unchanged in this PR; existing durable schedule, approval and unknown-effect behavior remains authoritative.
- Screenshots show only synthetic fixtures. The user's corrected screenshot is not included in this repository.
- Local code review identified and fixed stale memory proposal retry identities and polling interactions with task mode/file selection. Independent external review remains paused under the user's instruction; no private source was sent to a reviewer.

Limits: unsigned development build; plaintext local snapshots bounded to 16 MiB; no calendar/DST recurrence; no source file writing; no live weather or general browsing; suggestion quality is model-dependent; window closure keeps the process running while quit/sleep/poweroff stop execution. Pro orbit-app migration remains a separate follow-up.
