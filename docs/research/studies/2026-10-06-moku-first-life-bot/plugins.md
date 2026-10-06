# Shared plugins and Bot-specific tools

Revision: 2026-10-06 UTC. Design proposal only. No OAuth flow, credential access, network authorization, external draft write or sending was performed. No provider API/scopes were researched for this revision; Gmail and other adapters illustrate a contract, not verified availability or capability support.

## Product relationship

Plugins is a secondary Home navigation destination. Its connection list answers “Is it ready, and which Bots use it?” A small catalog introduces possible adapters. Detail shows one account alias and Bot assignments, with technical distinctions behind progressive disclosure. It must not turn everyday Home into a security dashboard. Bot Library chooses roles; Plugins manages shared tool connections. A Library blueprint contains neither credentials nor connection grants. Adding a Bot never gives it automatic access to every plugin.

Gmail is an example app-level account connection shared by explicitly selected Bot instances. Synthetic Personal inbox (`alex@example.invalid`) is ready; Pip is the only assigned Bot. Moku and Luma are Off for read, draft and send. Calendar/Notes and Archive inbox demonstrate reauthentication-required, unavailable and revoked states; these are fixtures, not claims that Nest supports those providers. A future Bot role's existing scope must still permit the requested job; changing plugin access cannot silently redefine the role.

## Three distinct boundaries

| Boundary | Proposed meaning | Must not imply |
| --- | --- | --- |
| Provider OAuth consent | Account-level ceiling for provider-authorized scopes | Provider supports per-Bot or selected-message scopes |
| App-enforced Bot permission | Narrower allowed capability for an identified Bot/account: read selected content, save draft, request send | A shared connection automatically authorizes all Bots |
| Per-action approval | Exact operation, account, recipients, payload and attachments approved by the user when consequential | A send-capable Bot or an enabled routine may send automatically |

Actual OAuth scope combinations, minimum privileges, token revocation behavior and API feasibility are unverified. “Selected messages” is the proposed app's restriction, not a claim about Gmail scopes. The UI should show the actual provider grant before connection and explicitly disclose a broader provider ceiling when necessary. Feasibility and permission review must precede implementation.

Read is bounded to explicitly selected message IDs/content, with clear provenance and no unrestricted mailbox browsing by the model. Local text composition is distinct from saving a draft to Gmail: saving a draft is an external write and requires exact approval. Send means permission to propose a send for review, never blanket execution authority. Approval preview shows From, To/Cc/Bcc, subject, full body and attachments (including empty fields); edits require a new approval. The static example has no Cc/Bcc or attachments and sends nothing. An approved draft does not approve sending it.

## Proposed enforcement outside the model

Validate typed commands in the trusted execution boundary, before any provider request: caller Bot identity, connection/account, exact capability, selected scope, current grant revision and applicable action approval. Never rely on role text, model reasoning, hidden prompt rules or renderer-only switches. The renderer remains sandboxed. A grant proposal is not active until explicit user review and persisted confirmation. Permission revocation takes effect on each subsequent execution check, including queued and scheduled work; stale approvals/grants fail closed. Read results are untrusted input and cannot expand permissions.

For consequential actions, bind approval to immutable payload/account/owner and an action identity, reject edits or stale grant revisions, and record attempts/results through shared Orbit durability. A request dispatched before revocation may still complete; do not claim it was undone. An uncertain provider response becomes Unknown and blocks automatic replay. Provider idempotency and outcome reconciliation are feasibility questions, not exactly-once guarantees. No generic shell/filesystem/network/model-tool surface is proposed.

## Connection and recurring-job states

| State | UI and job consequence | Recovery |
| --- | --- | --- |
| Connected + assigned | Eligible within current Bot permission and approval | Still validate at execution; enabled is not guaranteed success |
| Connected + Bot Off | No operation for that Bot | Explicit assignment review; no silent broadening |
| Reauthentication required | No provider operations; affected jobs pause with Action required | User reconnects, then separately reviews grants/jobs |
| Unavailable adapter/provider | Action required; stop retrying automatically and pause affected jobs | User-directed check/retry only; retain failure evidence |
| Revoked account/Bot capability | Stop new operations; cancel queued eligible work and pause dependent jobs | Regrant explicitly; never automatically restore all Bots |
| Waiting for send/draft approval | No external dispatch; waiting action with owner visible | Approve exact action or reject; never a scheduled automatic send |
| Unknown outcome | Keep blocked recovery state | Inspect actual outcome before deciding to retry |

Bounded retry policy for plugin outages is proposed: one failed attempt transitions to Action required; no infinite retry loop. A reconnect is not a retry command or approval. The owner-labelled Tasks/Recurring jobs views would project the affected Bot/account and reason, linking to plugin detail. Pausing the recurring job does not cancel an already-dispatched action. On app restart, validate permission again; app-closed execution limitations and shared Orbit ownership/durability remain unchanged. Any shared pause/materialization semantics belong in cybergarage/orbit, not a duplicate Nest ledger.

## Revocation, receipts and privacy hypothesis

Revocation stops future access; it cannot retract completed sends or draft writes. Before revocation, show affected Bots/jobs and the in-flight limitation. It must not demand continued provider access to revoke app permissions. Provider revocation is a separate capability that must be verified; the design promises no particular OAuth mechanism.

Proposed plugin audit receipts retain minimal local metadata for 30 days: Bot, account alias, operation category, timestamp, outcome and an opaque provider action identifier when needed. No message body, attachment, credential or token belongs in audit receipts or Git. Provide visible retention and delete controls; message inputs/results are transient unless the user explicitly confirms a bounded saved note. A role cannot silently copy email into memory.

Do not automatically erase unresolved execution evidence and thereby permit replay. Durable Unknown blocks are separate from the proposed bounded audit display; their safe retention/deletion and the core's existing history limitations need explicit design review before implementation. Credentials would require a separately reviewed native credential boundary, never plaintext profile memory or model context. Encryption/vault implementation, export/delete behavior and privacy guarantees are not established by these concepts.

## Manual validation additions

Ask a reviewer to find Plugins from Home, identify which Bot uses Personal inbox, explain why Moku is Off despite a connected account, distinguish provider consent from Bot permission, and state whether Pip may send automatically. Then simulate reauthentication/revocation and ask which job stops and what already-sent mail means. Record errors/time rather than claim a completed study. Initial criterion: every access/send/revocation answer correct without coaching; find the affected owner's job within 30 seconds. Validate that progressive detail remains understandable without overwhelming routine use.

## History

2026-10-06: added shared plugin catalog/connections and Gmail assignment/action-approval concepts after the clarified direction. This extends [multi-Bot structure](structure.md) and is recorded in [ADR 0004](../../../decisions/0004-shared-plugins-bot-permissions.md). Earlier mockups remain in Git at `f2a593a`; no runtime capability or product hypothesis is accepted.
