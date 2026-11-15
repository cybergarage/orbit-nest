# Project conversations and scoped context

Nest connects a Bot to multiple core Projects and separate core Sessions. The
[accepted decision](decisions/0009-project-session-context.md) records the boundary.
The host still runs one job at a time and only while the application is running.

## Workflow

Open a Companion and expand **Project conversations**. Create a Project, then
create a named conversation in it. Its name is stored with core Session title
metadata using a stable title operation ID. Select that conversation before local chat.
New scoped tasks carry an explicit Nest context marker; arbitrary legacy payload
context fields do not activate routing or projection. The selection is persisted per Bot. Switching it does not retarget queued tasks
or routines: each captures its original Bot, Project, Session and membership
revision. A stale UI target is rejected rather than silently redirected.

Each request uses the selected conversation's last eight user/assistant messages
(up to 2,000 characters per user message and 4,000 per assistant message) and core's
bounded eligible Project notes (at most 16 entries and 2,048 tokens). Separate
Sessions in one Project share eligible Project notes, but not conversation history.
Bot name, personality, tone and role remain persona; legacy Bot memory is excluded
from Project context. Notes and prior messages are untrusted context, not tool
instructions or permission.

**Project notes** accepts human-authored notes up to 8,000 characters. Keep them
short; a note that does not fit may be excluded by core selection. Exact context,
exclusions, membership revision and memory generation are retained in work-state
context evidence. Automatic extraction and automatic promotion of a result into
Project or Bot memory are disabled. The current UI adds notes; editing/retiring
existing Project notes is not exposed in this stage.

**Legacy / unclassified** preserves the previous Bot-scoped chat, memory and source
workflows. Project chat is excluded from that legacy chat context too. Existing
receipts, routines, approvals, writing evidence, IDs and Bot memory are not assigned
to a Project or copied into a Session. There is no automatic import or routing.

Project mode currently supports local chat and local-chat routines only. Select
legacy mode for manuscript or public-page workflows. Project membership does not
grant a folder, URL, tools or another Bot's sources. Ollama and optional Apple
remain explicitly selected local providers, with no cloud fallback or downloads.
Model selection remains Bot-scoped; per-conversation model controls are a separate
workstream. Current Nest submissions use normal priority; this stage does not introduce a
per-Session priority policy, new worker pool or concurrent execution.

## Persistence and result recovery

The existing work.json remains the task/attempt authority. Under the app-owned
context directory, projects.sqlite is core's persistent catalog and sessions/runs
are its registered transcript/journal roots. Nest stores Bot associations,
selection, creation intents and projection receipts in work application data;
it does not duplicate the Project catalog or execution ledger. Creation is bounded
to 200 retained operations and retains stable replay IDs.

A creation intent is durable before core Project/Session creation. If the host
stops after membership commit but before saving the association, the same operation
and reservation are reconciled; no second Session is chosen. Invalid requests
are rejected before recording an intent. Conflicting pending evidence is retained
and blocks execution until inspected.

A result is committed with its original attempt before Session projection. Its
user/assistant messages use deterministic IDs and bind the run, successful attempt
and result digest. On restart, a known saved result can be projected without
calling the model again. Existing messages must match exactly. A saved projection
receipt cannot hide missing or changed transcript messages before another request.
A cancelled/stale attempt cannot commit. Local note mutation and final memory
validation/result completion are serialized by the host. Core Session ownership
blocks membership moves while work is active. Do not mutate these stores through
another host while Nest owns them.

These stores do not share one database transaction. Projection failure is visible
and pauses new execution; it does not change a completed run into a pending run.
A process death before a read result is durably committed remains an interrupted
failure; no model retry is implicit. An opaque unknown outcome blocks claims and
requires explicit reconciliation. Transcript repair never authorizes replaying an
opaque operation or an external effect. There is no external exactly-once claim.

Core can reclaim an owner whose death is established through its normal guarded
transition. Retained guards, live/unknown owners, ambiguous registration or corrupt
records are not removed by Nest. Stop all writers and restarters and establish
exclusive administration before using the matching core storage inspection and
recovery procedures. Never clear coordination files merely to make the app start.
No reset, backup, daemon or automatic recovery override is added to Nest.

## Native distribution and qualification

The desktop uses an ESM catalog bridge and adjacent SQLite Worker, with a separate
Electron ABI build of pinned better-sqlite3. They are packaged outside ASAR with
runtime checksums and Electron/platform/architecture identity checks. This follows
[Electron's native-module ABI requirements](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules).
The Node test binding is not overwritten. Development native builds require a
supported C++ toolchain and Electron headers; the lockfile pins @electron/rebuild.
Portable builds validate JavaScript and types without compiling a desktop binding.

Local qualification covers macOS arm64, Electron 44.5.1 / module ABI 149,
better-sqlite3 12.11.1 and @electron/rebuild 4.2.1. The unsigned packaged app is
launched from an isolated working directory and temporary userData, creates two
Projects, writes scoped notes and a Session result, closes and reopens. It does not
need a sibling core checkout or live inference. Development native UI regressions
exercise the same restricted renderer/IPC boundary.

| Boundary | Regression evidence |
| --- | --- |
| Package identity | Archive SHA-256, lock integrity and selected installed core-module hashes; startup checks native and Worker artifacts. |
| Legacy work | v1 import preserves IDs, application data, terminal/approval/unknown state; unknown blocks inference. |
| Scheduling | Atomic claimNext, persistent aging, payload priority ignored as execution configuration and unchanged default order. |
| Creation | Stable Project/Session retries, changed-input rejection and restart after committed membership before association. |
| Isolation | One Bot, two Projects, two Sessions in one Project, distinct note/history markers and legacy context; selection changes do not retarget queued work. |
| Live changes | Stale membership rejected before model invocation; active moves rejected; cancellation and memory changes prevent stale completion. |
| Result projection | Exceptions and real child-process termination after saved result, complete user row and complete transcript; no second model call or duplicate pair. |
| Ambiguous evidence | Retained guard bytes remain unchanged; exclusively controlled fixture demonstrates explicit offline recovery. Missing applied transcript fails closed. |
| Desktop consumer | Sandboxed development and unsigned packaged UI create scoped state and reopen it; no model inference is needed. |

Deterministic tests use temporary roots and injected responses. Existing core
semantics remain those of the pinned revision; this stage does not requalify
physical power loss, arbitrary native platforms, distributed storage or external
effects. Packaging and portable CI results must be assessed on the exact PR HEAD.
