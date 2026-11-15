# 0009 — Connect Bot work to core Project and Session context

- Status: ACCEPTED
- Date: 2026-11-15 (UTC)
- Updated: 2026-11-15 (UTC)
- Decision owner: Maintainer
- Acceptance date: 2026-11-15 (UTC)
- Acceptance evidence: Maintainer requested implementation of Project/Session isolation, packaged SQLite qualification and safe recovery on 2026-11-15.
- Supersedes: None
- Superseded by: None
- Implementation status: Completed for the bounded first stage
- Implementation commit: eda7a9c6611440f5f7a4aa21103d86d78d72ec99
- Implementation qualification date: 2026-11-15 (UTC)

## Context

The approved next workstream connects Nest to Orbit Project/Session context after
core durable event ingestion and job priority. One Bot may serve multiple
Projects. Bot identity is not a Project, Session, execution ledger or permission.
This record adopts the concrete boundary; it does not accept the unrelated
product hypotheses in records 0001–0008.

At Nest `c0451c7196cb1b56a4fc7eb73dfe766811d02f8a`, chat context selects four
successful chat/result pairs by Bot ID. Bot memory and source grants are also
Bot-scoped. There is no core Session membership. that Nest revision pins core
`e4e8d2f8462bb3d7784ccd7adb8270800581a017`; having newer APIs on Orbit main
therefore does not make them available in the installed app.

Orbit `c120f125a81a7ac5fcb1b277b5c8bbd4cdc94315` provides a registered Session
repository, Project coordination, scoped memory, durable work and atomic job
selection. These are distinct stores with distinct recovery contracts. They do
not provide a cross-store transaction simply because the host uses them together.

## Decision

Adopt the following single-host host-integration contract.

### Ownership and isolation

Reuse core Project metadata, membership and memory services. Keep Bot persona,
Bot-to-Project associations and current UI selection in Nest. Keep task status,
occurrence IDs, attempts, approvals and recovery in DurableWorkStore. Do not create
a parallel Nest Project catalog, transcript ledger or execution engine.

A task captures an immutable target: Bot ID, Project ID (or explicitly unassigned),
registered Session ID and membership revision. A later UI selection must not
retarget queued work. A Session belongs to at most one Project. The host validates
both the Bot association and authoritative membership before context preparation
and again before execution. Renderer paths, payload priority or model output do
not establish membership or permission.

New explicit Project conversations use core Session ownership and ProjectService
creation reservations with stable operation IDs. Keep separate Sessions within a
Project separate: Project membership does not authorize concatenating every
transcript. Context consists of the chosen Session, bounded eligible Project
memory, and the Bot persona. Do not feed another Project's recent Bot history or
Bot's legacy memory into this context. A source grant is still checked independently;
Project assignment must not widen folder, URL, provider or tool permissions.

Keep the existing local-only inference boundary. Connecting an application service
must not implicitly instantiate unrestricted Agent tools, load workspace settings,
connect MCP, enable automatic knowledge extraction, choose a cloud provider or
start another scheduler. Prefer narrow core services with explicit injected host
and model boundaries; qualify any application-service use against these limits.

### Legacy state and migration

Leave existing receipts, request/occurrence/attempt IDs, schedules, approvals,
writing evidence and Bot memory intact. Missing Project/Session fields mean
legacy unclassified work, not the currently selected Project. Legacy Bot history
and memory stay in that legacy context until an explicit, previewed import.
Never infer a Project from prompt wording, folder name or Bot role.

An import must retain immutable origin identifiers and stable operation IDs,
record per-record progress, and tolerate an interruption between core transcript
creation and Nest association persistence. Reconcile the same reservation; never
silently choose a new Session or duplicate a task. Corrupt or conflicting evidence
requires inspection. Moving an existing transcript retains its historical
content and requires an explicit warning; it is not a privacy scrub.

### Cross-store completion and recovery

Use DurableWorkStore's atomic claimNext selection, one active executor and
conservative unknown stop when the core pin is upgraded. Event acceptance,
job admission, Session append, task completion and UI notification remain distinct.
Core EventStore's transaction does not encompass SQLite or Session files.

Before bridging a successful result into a Session, persist stable run/attempt
and transcript-effect correlation. Use result-before-projection ordering; a partial or complete transcript append
before the projection receipt is saved is idempotently reconciled. Do not advertise atomic completion across
stores. An ambiguous opaque action remains unknown; a missing transcript append
or delivery acknowledgment never authorizes repeating the external action.
A known recorded result may be projected idempotently only after proving its
correlation, source status and current Session ownership.

Cancellation, pause and schedule removal retain core terminal-state handling.
Reject stale attempt results and membership changes during active or quarantined
work. Neither context integration nor priority permits preemption or additional
concurrency.

### Qualification order

1. Upgrade the immutable core package pin and prove legacy work import, priority
   selection, unknown stops, local model adapters and desktop startup compatibility.
2. Qualify persistent Project storage in a packaged Electron app. Core's SQLite
   adapter uses an ESM-relative Worker and better-sqlite3. Nest currently bundles
   main into CJS and excludes node_modules from its package. Package an explicit
   Worker and ABI-compatible native module, verify provenance, and close the
   worker on shutdown. Do not substitute volatile MemoryProjectStore in production.
3. Connect explicit Project/Session creation and selection, captured task targets
   and scoped context. Keep legacy/unassigned access available. The UI needs a
   visible target and a correction path; automatic routing is outside this stage.
4. Qualify result projection and restart recovery, then expose scoped curated
   memory. Do not automatically promote Bot memory or enable extraction jobs.

See [the qualification matrix](../project-session-integration.md). Each gate must
pass before the dependent behavior is enabled; this record is not evidence that
any gate has passed.

## Consequences

Core remains authoritative for durable work and Project/Session state. Nest owns
persona and presentation. Isolation is testable without real user data or model
calls. The cost is an explicit multi-store recovery protocol and native desktop
packaging work before feature activation. An API-only change is insufficient.

This stage excludes parallel/distributed execution, message/approval/notification
event adapters, automatic routing, external integrations or sending, shopping
operations, new tools, daemons and migration of orbit-app. No next PR auto-merge
is authorized by the completion of Orbit PR #38.

## Evidence

Observed source, inspected 2026-11-15:

- [Nest runtime](https://github.com/cybergarage/orbit-nest/blob/c0451c7196cb1b56a4fc7eb73dfe766811d02f8a/src/runtime.ts): Bot-scoped history, memory and direct task claiming.
- [Nest build](https://github.com/cybergarage/orbit-nest/blob/c0451c7196cb1b56a4fc7eb73dfe766811d02f8a/scripts/build.mjs) and [package](https://github.com/cybergarage/orbit-nest/blob/c0451c7196cb1b56a4fc7eb73dfe766811d02f8a/scripts/package.mjs): CJS bundling and excluded dependencies.
- [Core ProjectService](https://github.com/cybergarage/orbit/blob/c120f125a81a7ac5fcb1b277b5c8bbd4cdc94315/src/core/projects/service.ts): registered membership, reservations and writer ownership.
- [Core SQLite adapter](https://github.com/cybergarage/orbit/blob/c120f125a81a7ac5fcb1b277b5c8bbd4cdc94315/src/core/projects/sqlite-store.ts): ESM-relative owned Worker.
- [Core application integration contract](https://github.com/cybergarage/orbit/blob/c120f125a81a7ac5fcb1b277b5c8bbd4cdc94315/docs/projects.md): catalog, membership and scoped-memory limits.
- [Core Project catalog decision](https://github.com/cybergarage/orbit/blob/c120f125a81a7ac5fcb1b277b5c8bbd4cdc94315/docs/adr/2026-09-22-project-catalog-and-session-membership.md) and [memory decision](https://github.com/cybergarage/orbit/blob/c120f125a81a7ac5fcb1b277b5c8bbd4cdc94315/docs/adr/2026-09-22-project-memory-context.md) retain source-pinned Codex/Pi comparisons. Those comparisons support reusing separated persistence/context responsibilities, not a claim that Nest's proposed bridge or Electron packaging has been qualified.
- [Existing product research](../research/studies/2026-10-06-moku-first-life-bot/README.md) remains hypothesis evidence, not approval of routing or memory sharing.

## Alternatives

| Option | Evaluation |
| --- | --- |
| Add only Project IDs to existing Bot receipts | Small patch, but does not establish core membership, Session ownership or a recoverable transcript bridge. |
| Instantiate the complete default core agent workflow | Reuses a broad surface but can change tool/provider/settings behavior; requires explicit restricted host design first. |
| Keep a second Nest Project/transcript store | Avoids initial native integration but duplicates durability and migration responsibilities; not proposed. |

## Implementation qualification

The first implementation covers explicit Project/Session creation and selection,
scoped local chat and human-authored notes, non-destructive legacy retention and
result-first transcript projection. The maintained integration guide owns limits
and qualification evidence. Automatic legacy import, source workflows in Project
mode, note editing UI, routing and parallel execution remain outside this stage.

Electron requires rebuilding native modules for its ABI; the implementation uses
@electron/rebuild 4.2.1 and verifies its separate runtime artifacts. See the
[official native-module guide](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules).
Core's normal known-dead owner recovery is retained. Ambiguous guards/owners require
offline inspection; no force-recovery path is added.

Local qualification at the implementation commit passed core provenance checks,
lint, types, 33 deterministic unit tests, seven native UI tests and the unsigned
packaged Project/Session consumer on macOS arm64. The live Apple inference test
was intentionally skipped. The package uses Electron 44.5.1 / ABI 149 and
better-sqlite3 12.11.1. Other platforms and physical power-loss behavior are not
established by this evidence. The exact PR HEAD remains subject to existing CI.
