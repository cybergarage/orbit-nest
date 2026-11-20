# 0010 — Use Core's host-permitted Project memory search

- Status: PROPOSED
- Date: 2026-11-20 (UTC)
- Updated: 2026-11-20 (UTC)
- Decision owner: Maintainer
- Acceptance date: None
- Acceptance evidence: None; implementation work was requested, but this detailed decision remains under review.
- Supersedes: None; proposes a refinement to decision 0009's Project chat boundary.
- Superseded by: None
- Implementation status: Candidate implementation in the accompanying Draft PR; not merged or deployed.

## Context

Nest `00ab03a0` has persistent Bot associations, Core Project membership/notes and
Session transcripts, but invokes Ollama directly. Core `d7535aa8` adds automatic
scope-fixed search to ordinary managed Session runs. A tool callback cannot be
added to the old text-only HTTP call and treated as a managed search implementation.
Core owns definitions, dispatch, capability policy and canonical search; Nest owns
application authorization and immutable Bot targeting.

## Decision

The candidate uses an explicitly configured Core Agent for Project-bound Ollama
chat. It reuses the registered Session, canonical ProjectMemoryService and saved
selected model, and passes a revocable host callback through `memorySearch`.
Built-in tools and inherited MCP servers are disabled. The operation policy allows
only the fixed scoped read. Renderer/model input cannot choose a grant or scope.

Core records complete managed turns and tool pairs. Nest remains the work/attempt
completion authority and verifies completed Core turns without appending a second
transcript pair. Interrupted turns stay on disk without redispatch; model input
excludes uncommitted turns as complete groups. The previous four-exchange history
policy is retained using whole turns, preserving tool-call/result pairs.

The managed route does not pre-inject notes or create snapshots. Apple retains
its existing text-only snapshot route until the dedicated Core model/helper/catalog
contract is separately integrated. Legacy and source workflows are unchanged.

## Consequences

Project Sessions may search shared canonical memory without sharing conversation
history. Existing IDs, membership and notes remain intact. No MEMORY.md import,
automatic extraction, compaction, summary, retention, new UI or background worker
is introduced. Four turns alone do not guarantee that the full request fits the
model context limit. Revocation prevents new reads, not removal of previously
stored evidence. There is no cross-store transaction or exactly-once inference claim.

The Draft PR pins the official source-commit package and checksums. Synthetic
isolation, permissions, capabilities, restart/crash recovery and ordinary chat are
checked locally; native Electron behavior is qualified in CI without operating
the user's screen. Functional tests are not model-answer quality benchmarks.

## Evidence

- [Core #43 API at d7535aa8](https://github.com/cybergarage/orbit/blob/d7535aa86920d3835f6d9ab3f4afbe75174d2f96/docs/session-memory-search.md).
- [Nest design addendum](https://github.com/cybergarage/orbit-nest/issues/21#issuecomment-6984401181).
- [Existing accepted Project boundary](0009-project-session-context.md).
- [Maintained workflow and limitations](../project-session-integration.md).
- `test/project-memory-search.test.ts` and the existing crash/restart suites use synthetic data.
