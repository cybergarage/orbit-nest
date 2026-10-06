![Work in progress](https://img.shields.io/badge/status-Work%20In%20Progress-8A2BE2)
[![Build Status](https://github.com/cybergarage/orbit-nest/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/cybergarage/orbit-nest/actions/workflows/test.yml)

# Orbit Nest

Personal Bots: local-first desktop companions powered by Orbit.

Related projects: [Orbit](https://github.com/cybergarage/orbit) · [Orbit App](https://github.com/cybergarage/orbit-app).

A local-first desktop prototype with Moku, a quiet focus companion, and configurable local conversation, research and manuscript-writing Bots. Home shows the roster and owned work; Library adds separate Bot instances, and Tasks and Recurring jobs provide owner-filtered views. Each Bot has its own profile, explicit model selection, memory and approved source scope. This is an initial prototype, separate from the professional orbit-app.

## Launch on the M4

Node 20.19+ and npm are required for source builds. The packaged macOS arm64 app uses its bundled Electron runtime. Start the locally installed Ollama application. Open a Companion’s Local model setup, check the available inventory and explicitly select an installed text model. Existing profiles keep gemma4:12b until you change them. Nest never downloads models, starts new services, or silently switches to cloud inference.

```sh
npm ci
npm run build
npm start
```

An unsigned development app is produced by `npm run package` under `release/Orbit Nest-darwin-arm64/Orbit Nest.app`. No signing, login item, daemon or package publication is performed.

## Moku prototype

Fresh installations include Moku with no selected model. Existing stores keep their prior Bots and offer Add Moku through Bots/Library. Choose one small step, start/pause a 25-minute focus session, and leave an explicitly reported progress or break note with a next step. Timer expiry never marks a task complete or triggers model/scheduled work. Closure reports, next steps and optional decorations survive restart. Keepsakes are disabled initially; when enabled, one start and one closure acknowledgement per UTC day can collect three decorations. A persisted high-water day prevents clock rollback/timezone changes from granting extra rewards. No neglect punishment, streak loss, spending or hour-based reward. Reward caps do not discard progress notes.

Plugins lists actual per-Bot local capabilities and saved scopes. Gmail is explicitly unavailable and disconnected; no OAuth, credentials, reading, drafts or sending are implemented. Theme selection remains deferred; the current light palette uses semantic tokens.

See [prototype status and manual checks](docs/moku-prototype.md). The illustration is a temporary original design asset, not final identity.

## Explicit local model setup

Ollama inventory is read only from loopback 127.0.0.1:11434. Setup distinguishes an unreachable service, a connected empty inventory, invalid inventory and available models. Missing saved models remain visibly unavailable; nothing substitutes another model. Embedding-only models are disabled/rejected. Older servers without capability metadata show that uncertainty. Start your existing Ollama app or install a suitable text model yourself, then recheck; Nest does not do either automatically.

Provider/model selection is saved per Companion. Both supported providers are local; Cloud is explicitly not configured, and no API keys, paid calls or cloud integration are added. New task/routine payloads capture provider/model, and receipts record actual model attempts. Changing selection cancels that Companion's queued/running model tasks but preserves memory approval/history. Saved routines retain their selection and should be recreated after a model change. Older routines without selection are treated as their original Ollama/gemma4:12b configuration and fail explicitly if changed; they are not silently rerouted. Source selection, profile, memory, history and writing baselines are retained.

## Optional Apple text chat on M4

Apple Foundation Models uses the exact shared Orbit optional text adapter and separately compiled Swift helper. It requires an already-compatible Apple silicon Mac/macOS 26+, SDK/compiler, user-accepted agreements and already-ready Apple Intelligence. Availability is probed; Nest does not enable Apple Intelligence, download assets, accept terms or change accounts/permissions.

From a source checkout, compile explicitly:

```sh
npm ci
npm run build
npm run apple:build
npm start
```

The helper is placed in dist/native. To include it in the unsigned development app:

```sh
NEST_INCLUDE_APPLE=1 npm run package
```

Packaging verifies its source/binary provenance and copies it outside the ASAR to the app's Contents/Resources. Runtime resolves that packaged-relative path, with no dependency on a temporary absolute path or environment override. Ordinary install/build/package does not compile or require Swift and remains portable. A build without the optional helper shows actionable unavailability and preserves Ollama.

Select Apple/system explicitly in Companion setup for text chat only. Transcript replay and owned native-process cancellation are supported. Tools, structured/JSON generation APIs, streaming and manuscript/public-page workflows are unsupported. Source previews are blocked before capture when Apple is selected; select Ollama explicitly for those workflows. There is no automatic fallback. Context/guardrail/unavailable errors are saved failures; shortening a conversation/profile may be needed for the system model's context limit.


## A first task

Open either Companion and choose Local chat to talk without selecting a source; enter a task, preview it, then Send. Customize Companion brings name, personality, tone, role, editable memory and allowed sources together. These fields are sent to the local model, and each Companion has isolated chat history and memory. Unsaved profile drafts remain scoped to their Companion; a revision check prevents overwriting a newer profile or approved memory.

For writing, choose a small synthetic folder through the native picker, refresh the manuscript list, explicitly select 1–12 top-level .md/.adoc/.asciidoc/.txt files, and save the selection. Choose Review selected manuscripts and ask for manuscript review, verified changes or next revision points. Each file is limited to 128 KiB, with 256 KiB combined. Symlinks, changing bindings, invalid UTF-8 and traversal are rejected. Nothing writes to the source folder.

The first successful review establishes a baseline for that exact Companion, folder and file selection. Later reviews compare SHA-256 and copied before/after changed regions against the last successful review. A changed region can include unchanged lines between edits; it is not a minimal patch. Failed, cancelled and interrupted candidates do not become baselines. Full selected text is retained in plaintext local state for comparison. The model sees bounded excerpts/changed regions, at most 16,000 source characters; results state coverage and truncation. Suggestions remain model output rather than verified edits.

Live weather, location-aware forecasts and general browsing are unavailable. A weather question receives an honest capability explanation. Missing initial sources have actionable selection guidance instead of claiming a prior grant was revoked.
Research companion checks one explicitly selected HTTPS page. Initial supported hosts are example.com, introducing.muse.ai and docs.x.ai. Other hosts, credentials, custom ports, redirects and oversized/non-text responses are rejected. This is a deliberately limited public-page checker, not general web browsing. The host allowlist relies on the system's trusted DNS/TLS configuration.

The explicitly selected local model gets the Companion's name/personality/tone/role/memory and, for local chat only, up to four successful prior chat/result pairs from that same Companion. No model tool execution, shell, arbitrary network, external sending, purchases or source-file writes are enabled. Sources are treated as untrusted content. Only explicitly captured source context and the current Companion context are sent to loopback Ollama.

Edit memory explicitly or choose Review saving to memory on a completed result. The exact replacement is displayed on a persistent approval card. If memory changed after the proposal, approval fails closed and preserves the newer memory. Approval and the eventual local memory mutation/result are durable. No external write tools are present. An interrupted memory attempt is conservatively marked unknown; confirm it stopped before closing unresolved work. No automatic replay of uncertain effects.

## 2D workflow board

Home shows each Companion's role summary, actual current work, next recurring job and optional latest persisted result. Inspect captured scopes in receipts, Plugins or Bot settings. Open saved result focuses its real history receipt. State filters distinguish approval required, queued, running, completed, failed, cancelled and unknown/interrupted. Completion is the shared Orbit run status, never inferred from chat wording; a result receipt records local model output or an approved memory update, not proof of an external action.

Local chat can Send directly; the main process validates its saved Bot/model scope before enqueue. Selected-source tasks and Schedule task still require Preview task before confirmation. An optional reviewed chat preview also remains profile-bound. The unsubmitted proposal shows the exact prompt, scope, supported read-only action and limits. Preview does not read source bodies or create a run. A backend token binds the prompt/mode and saved Companion profile/source selection; changed scope, memory or profile requires a fresh preview. Files can change before capture, and actual read evidence is reported in the saved result. Memory changes retain their persistent exact-replacement approval cards. No arbitrary side-effect preview is promised.

Stop this Companion pauses only its routines and cancels only its queued/running/approval work. Running read cancellation is cooperative: local model computation may continue briefly, but cancelled output cannot become a completed result. Interrupted opaque work remains unknown, with replay blocked; stop does not prove an effect was undone. Routine Pause affects future scheduling, while Cancel/Request stop targets an individual run. Existing routine Run now uses a stable request ID during retries; UI controls reject simultaneous repeated clicks.

Proposals and filters are UI state, not another execution ledger. The board projects existing Orbit records and per-Companion data; it introduces no autonomous collaboration, trading, 3D, project fiction or new tools. The layout supports keyboard controls and narrow windows.


## Routines and recovery

Fixed elapsed-time intervals: 1 minute (trial), 15 minutes, 1 hour, 24 hours. No calendar timezone/DST recurrence. The initial missed-run policy coalesces elapsed intervals into the latest due occurrence on return. Pause affects future materialization; cancel stops an individual queued/running task. A paused routine can resume; already-created work remains in history. Scheduling snapshots retain the selected scope; editing/revoking a source causes old work to fail instead of accessing a new source silently.

Closing the window keeps the Electron process and scheduler running. Reopen from the application menu or Dock. Quit, sleep, poweroff and a stopped Ollama prevent execution. On restart, interrupted reads resume with the same request ID; uncertain effects are blocked. There is no system service and no poweroff/offline promise. A model call can occur again after an interrupted read, but the visible result is recorded once. This is not exactly-once external execution.

Shared durability is implemented in cybergarage/orbit's `DurableWorkStore`, not a Nest-only scheduler. Separate schedules, occurrences, runs and attempts are atomically stored with the next cursor. One local writer uses an exclusive owner lock and atomic synced snapshots; live owners are rejected, corrupt evidence is preserved. Local filesystem only. State is bounded to 16 MiB; a full history fails closed and currently requires manual archival. Plaintext local state lives in Electron's application data folder. Back it up independently of source repositories.

## Reviewed core dependency

`vendor/orbit-core-<source>.tgz` is a committed, reproducible npm package from the reviewed shared-core commit (now merged into Orbit main). `vendor/core-provenance.json` pins its full source commit and SHA-256. It is not an npm release. Regenerate only from the reviewed core revision using `npm pack`, then update both provenance and package lock. The dependency is bundled into Electron main; no sibling checkout is needed after installation. The Orbit package retains its existing licensing and notices.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run test:ui
npx tsx scripts/live.ts
npx tsx scripts/writing-live.ts
npx tsx scripts/apple-live.ts # opt-in, compiled helper and ready Apple model required
npx tsx scripts/crash-live.ts
npm run package
```

Unit tests use synthetic fixtures. Native UI tests cover renderer isolation, profile/history persistence, persistent memory approval and routine controls. `evidence/` contains synthetic-only screenshots and actual M4 `gemma4:12b` live/crash results. Core tests additionally exercise SIGKILL recovery, stable IDs, one visible result, cancellation, owner exclusion and unknown-effect quarantine. CI uses mocked/local-only unit and UI fixtures; actual Apple UI checks are opt-in with NEST_LIVE_APPLE=1, run on the inspected M4. Linux/Windows CI checks install, types, unit and source build without a helper. CI does not claim live model validation.

## Competitor research

See the [research index](docs/research/README.md) for evidence, visual comparisons, shared use cases and proposed decision records. Research proposals are not approved product decisions.

## Product scope and next steps

This slice adopts clear Bot roles from [Grok Bots](https://docs.x.ai/grok-bot/bots), approachable task interaction from [ASIST](https://github.com/nyosegawa/asist), and visible activity, editable memory and explicit approval cards from [Muse](https://introducing.muse.ai/). No proprietary assets are copied. Muse's cloud availability is not a Nest capability.

Voice, mobile, autonomous multi-Bot delegation, cloud hosting, transactions and elaborate avatars are deferred. Native file export/organization needs a separately proven operation approval boundary. Better history archival, additional safe public sources and orbit-app adoption remain follow-up work. The pro app's Docker/worker recovery is not migrated implicitly.

The model receives at most 16,000 source characters. Longer sources produce an explicit truncation notice in the result. Routine cards also provide Run now; Remove folder access revokes future folder work. See [shared-core compatibility and migration](docs/core-integration.md).

### Launching a rebuilt desktop package

After `npm run package`, run `./scripts/start-packaged.command` from this checkout (or open that command file in Finder). It executes this checkout's packaged binary directly, avoiding application-name resolution among older copies. Quit an already running older Nest before switching builds: the single-instance lock otherwise routes the launch to the existing process. Closing its window keeps the process running; use Quit to switch builds.

User history and settings remain in Electron's `orbit-nest` application-support directory across rebuilds. Back up that directory before investigating persistence failures. Never initialize or delete history to recover a closed store. Local `recovery/` backups are ignored by Git and excluded from desktop packages.
