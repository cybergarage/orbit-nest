# Shared core integration boundary

Nest imports the shared DurableWorkStore from the pinned Orbit package. Schedule cursors, occurrence materialization, stable request IDs, attempts, cancellation, approval state and one visible result belong to that store. Nest's host supplies deterministic selected-source reads and loopback-only Ollama inference. It does not provide arbitrary agent model tools.

The existing professional orbit-app checkout and its Docker worker boundary are preserved. Its current schedule implementation consumes a reservation before random-ID submission. A future separate migration must bind one persisted occurrence to a stable Orbit request ID, preserve that ID through worker transport retries, and map terminal worker events to durable completion. Submission acceptance is not completion. Worker operation journals, persisted approvals and explicit external reconciliation must remain authoritative for opaque tool effects; an interrupted worker must never be treated as a safely repeatable read-only Nest summary.

Legacy schedules need an explicit one-time import record and reversible compatibility mapping. UI schedules can be a projection of the shared store, but must not independently advance their cursor. Existing Docker ownership/recovery and approval regression tests must pass in that separate branch. No partial migration is enabled implicitly in this prototype.

The vendored core archive contains existing Orbit licensing and notices unchanged. It is an unmerged local package snapshot, not a publication. Source commit and SHA-256 are in vendor/core-provenance.json; npm's lockfile also records package integrity. Verify with npm run core:verify before installation. Upgrading requires rebuilding and reviewing that exact core revision and updating both provenance and lockfile.

Use immutable source-named archives when upgrading. npm can retain an older installed package if the same local archive path/version is overwritten. core:verify checks archive SHA-256 and lockfile SHA-512; core:verify-installed additionally checks the installed scheduler module against the exact source build.
