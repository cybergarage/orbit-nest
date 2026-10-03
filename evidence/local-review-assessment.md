# Local-only review assessment

The independent reviewer was the installed gemma4:12b model on loopback Ollama, not an external code-review service. Raw report: local-core-review.json. This is a limited local model review and does not substitute for expert review of filesystem failure behavior.

- Alleged concurrent in-memory update race: rejected. Transactions are synchronous, contain no await/callback reentry, and hold one process owner lock. State is read from the committed snapshot after restart. SIGKILL recovery exercises that behavior.
- File-permission allegation: no actionable defect. Directory creation errors throw, and private files use mode 0600. Existing app-data directory ACLs remain an OS/user responsibility.
- PID reuse: accepted as an explicit limitation. A reused live PID fails closed; inspect/remove the stale lock manually only after confirming no store owner is running. The implementation does not steal a live lock.
- Alleged partial materialization: rejected. Every schedule/cursor change is inside one cloned snapshot and one atomic rename transaction, not separate writes in a loop.
- Array/snapshot cost: accepted as a scalability limit. State is capped at 16 MiB and the initial scope is two desktop Bots. Larger deployments need a transactional database/archival strategy.

No source was sent to an additional external reviewer. External Codex CLI review remains paused following automatic approval rejection and the parent's instruction to use local review only.
