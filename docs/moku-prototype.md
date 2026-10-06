# Moku working prototype

2026-10-06 UTC. Builds on design PR #6, squash-merged at `2ba52479de70624413ed6752f12fafa033d925db`. This implementation is separately reviewed; research hypotheses remain proposed and unvalidated. ADR 0001 was not accepted by the merge. Core package/source/checksum are unchanged.

## Implemented scope

Warm left navigation, prominent original Moku art and original owl/fox illustrations; Home/Library, separate Bot instances and editable profiles, conversation with owned work sidebar, Tasks and Recurring jobs with owner filters/counts/next due/paused states. Ordinary local chat uses main-process validation directly; selected-source work, routines and exact memory replacement preserve preview/approval boundaries. Gmail controls are disabled and unavailable. Local source capabilities derive from trusted template metadata, never a user-edited role/name. Shared execution remains in Orbit.

Moku has explicit step/start/pause/resume/closure, user-reported progress and return notes. Reports are retained separately from model receipts, with prior reports inspectable. Timestamp-based timers show elapsed time after restart, without claiming background focus execution or completion. Optional keepsakes start disabled and collect only three decorations, with one start and one deliberate closure per UTC day. UTC high-water periods and stable event IDs are saved atomically with notes/possessions; backwards dates grant no new reward. No minute rewards, care demands or absence penalties. No scheduled monitoring. Decorations can be placed/removed; no alternate animated expressions are implemented.

## State compatibility and boundaries

`work.json` remains in Electron userData, never Git. Existing Bot IDs, profiles, source grants, revisions, memory, model selections, schedules, runs/attempts and writing baselines stay intact. Existing stores are not reseeded. Fresh stores add Moku; Library additions contain no memory, source access or selected model. Legacy `documents` and `research` IDs map to their previous capabilities; new instances use server-selected templates. New user state lives in optional `data.life`, one atomic aggregate mutation. Unrecognized/unsupported IPC actions fail closed. Renderer sandbox, context isolation, CSP and sender/frame checks remain.

Focus events and prior notes accumulate within the existing shared 16 MiB store limit; a full/uncertain store fails closed, preserving prior data, and requires archival. This prototype has no automatic archival/deletion. Models remain explicitly local, with no cloud fallback or downloads. Source changes preserve existing cancellation/scope checks. No user-data migration or actual user routine was executed during validation; tests use isolated synthetic data.

## Run and manually review

The unsigned macOS arm64 app stays at `release/Orbit Nest-darwin-arm64/Orbit Nest.app`. Use `scripts/start-packaged.command` from this checkout. Quit an older running Nest through its app menu first: closing a window keeps that process running, so a second launch correctly reopens its current instance. No duplicate app copy, daemon or login item is installed.

1. Open Home, then Moku (or add it from Bots on an existing store). Inspect the character and right work sidebar.
2. In Model & profile settings, explicitly select an already-installed local model. Send ordinary chat without Preview; inspect the actual persisted result. Missing models produce failure, not a fabricated reply or fallback.
3. Choose a small step, enable optional keepsakes if desired, start/pause focus and leave a break/progress note with the next step. Place a collected decoration. Quit and reopen; confirm notes and decorations survive.
4. Browse Tasks/Recurring jobs and filter by owner. Review approval/unknown states and next due/paused counts. Timer time does not mark any task completed.
5. Open Plugins. Inspect actual local scope, and confirm Gmail is unavailable with disabled read/draft/send controls. Narrow the window and expand/collapse Navigation; controls and notes remain reachable.

Theme selection, real provider integration, richer nurturing/animation and measured one-week self-use efficacy remain deferred. Existing proposed ADRs remain hypotheses; implementation does not claim their validation.

## Evidence

All screenshots use synthetic fixtures. [Home](../evidence/moku-home.png), [conversation](../evidence/moku-conversation.png), [narrow Plugins](../evidence/moku-narrow.png). Native and packaged suites cover profile drafts, owner filters, repeat clicks, denied renderer tools, stale scope, approvals/recovery, source selections, missing model, timer/decoration restart, primary Quit and secondary-launch single-instance behavior. Actual already-ready Apple text chat uses a synthetic cobalt fact; no user profiles or model settings are changed. Local Ollama validation uses the existing installed model and synthetic meeting text.
