# Orbit Nest

A local-first desktop prototype for two approachable companions: research and document organization. Each Bot has a configurable name, role, editable memory, conversation/results and selected source. Home combines current work, history and approvals. This is an initial private prototype, separate from the professional orbit-app.

## Launch on the M4

Node 20.19+ and npm are required for source builds. The packaged macOS arm64 app uses its bundled Electron runtime. Start the locally installed Ollama application with `gemma4:12b` already installed. Nest never downloads models or silently uses cloud inference.

```sh
npm ci
npm run build
npm start
```

An unsigned development app is produced by `npm run package` under `release/Orbit Nest-darwin-arm64/Orbit Nest.app`. No signing, login item, daemon or package publication is performed.

## A first task

Open Document organizer, expand Profile, memory & permissions, and select a small synthetic text folder with the native picker. Give it a task and choose Run now. Files are read only: top-level .txt/.md/.csv, at most 20 files, 32 KB per file and 64 KB combined; symlinks and changed bindings are rejected. No filesystem path supplied by model output is executed.

Research companion checks one explicitly selected HTTPS page. Initial supported hosts are example.com, introducing.muse.ai and docs.x.ai. Other hosts, credentials, custom ports, redirects and oversized/non-text responses are rejected. This is a deliberately limited public-page checker, not general web browsing. The host allowlist relies on the system's trusted DNS/TLS configuration.

The model gets the Bot's role/memory and up to four successful prior task/result pairs. No model tool execution, shell, arbitrary network, external sending, purchases or source-file writes are enabled. Sources are treated as untrusted content. Only summaries of selected sources are sent to loopback Ollama.

Edit memory explicitly or choose Review saving to memory on a completed summary. The exact replacement is displayed on a persistent approval card. Approval and the eventual local memory mutation/result are durable. No external write tools are present. An interrupted memory attempt is conservatively marked unknown; confirm it stopped before closing unresolved work. No automatic replay of uncertain effects.

## Routines and recovery

Fixed elapsed-time intervals: 1 minute (trial), 15 minutes, 1 hour, 24 hours. No calendar timezone/DST recurrence. The initial missed-run policy coalesces elapsed intervals into the latest due occurrence on return. Pause affects future materialization; cancel stops an individual queued/running task. A paused routine can resume; already-created work remains in history. Scheduling snapshots retain the selected scope; editing/revoking a source causes old work to fail instead of accessing a new source silently.

Closing the window keeps the Electron process and scheduler running. Reopen from the application menu or Dock. Quit, sleep, poweroff and a stopped Ollama prevent execution. On restart, interrupted reads resume with the same request ID; uncertain effects are blocked. There is no system service and no poweroff/offline promise. A model call can occur again after an interrupted read, but the visible result is recorded once. This is not exactly-once external execution.

Shared durability is implemented in cybergarage/orbit's `DurableWorkStore`, not a Nest-only scheduler. Separate schedules, occurrences, runs and attempts are atomically stored with the next cursor. One local writer uses an exclusive owner lock and atomic synced snapshots; live owners are rejected, corrupt evidence is preserved. Local filesystem only. State is bounded to 16 MiB; a full history fails closed and currently requires manual archival. Plaintext local state lives in Electron's application data folder. Back it up independently of source repositories.

## Reviewed core dependency

`vendor/orbit-core.tgz` is a committed, reproducible npm package from the unmerged shared-core branch. `vendor/core-provenance.json` pins its full source commit and SHA-256. It is not an npm release. Regenerate only from the reviewed core revision using `npm pack`, then update both provenance and package lock. The dependency is bundled into Electron main; no sibling checkout is needed after installation. The Orbit package retains its existing licensing and notices.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run test:ui
npx tsx scripts/live.ts
npx tsx scripts/crash-live.ts
npm run package
```

Unit tests use synthetic fixtures. Native UI tests cover renderer isolation, profile/history persistence, persistent memory approval and routine controls. `evidence/` contains synthetic-only screenshots and actual M4 `gemma4:12b` live/crash results. Core tests additionally exercise SIGKILL recovery, stable IDs, one visible result, cancellation, owner exclusion and unknown-effect quarantine. CI uses mocked/local-only unit and UI fixtures; it does not claim live model validation.

## Product scope and next steps

This slice adopts clear Bot roles from [Grok Bots](https://docs.x.ai/grok-bot/bots), approachable task interaction from [ASIST](https://github.com/nyosegawa/asist), and visible activity, editable memory and explicit approval cards from [Muse](https://introducing.muse.ai/). No proprietary assets are copied. Muse's cloud availability is not a Nest capability.

Voice, mobile, autonomous multi-Bot delegation, cloud hosting, transactions and elaborate avatars are deferred. Native file export/organization needs a separately proven operation approval boundary. Better history archival, additional safe public sources and orbit-app adoption remain follow-up work. The pro app's Docker/worker recovery is not migrated implicitly.
