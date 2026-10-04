# Local model setup validation

M4 validation on 2026-10-04, using synthetic fixtures only.

- Orbit source: e4e8d2f8462bb3d7784ccd7adb8270800581a017. Immutable local archive and installed scheduler, Apple adapter and Swift source checks passed. Core headers, build, full tests and package consumer passed before packing; no core source changes or publication.
- Nest lint, TypeScript, 14 unit tests, build and optional Apple packaging passed.
- Five native and five packaged Electron UI tests passed, including actual Apple Foundation Models chat and persisted selection.
- Actual Apple local text chat replayed its own saved transcript after restart; repeated request IDs retained two results for two distinct requests; cancellation saved no fabricated result. Source workflows remain unsupported for Apple.
- Actual Ollama gemma4:12b manuscript review passed before and after restart. Scheduled SIGKILL recovery produced one visible result across two attempts, retaining the stable request ID.
- Apple helper was explicitly compiled on this M4 from pinned source, target arm64-apple-macos26.0. SHA-256: 2e79542948da7013938ab7eb66a389be32feb115f092c96e16e00f019f877fcf. Packaged resource provenance verified.
- Ordinary install/build does not compile Swift. Linux and Windows install/lint/types/unit/build are checked separately by exact-head CI. Live Apple tests require the explicit local opt-in and are skipped on ordinary CI.

The M4 application remains unsigned. Apple supports bounded text chat only, without tools, streaming, JSON generation or source reviews. No cloud API, model download, Apple readiness changes, service changes or automatic provider fallback occurred. External review remains disabled; no independent-review claim is made.
