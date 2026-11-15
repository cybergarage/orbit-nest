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

## Durable local result notifications

The next bounded stage adds a local inbox on top of already-persisted results.
`work.json.notifications.json` sits beside work.json in app-owned userData,
outside Git. It uses the pinned core EventStore for immutable facts, pending
consumer deliveries and atomic receipt admission. It adds no executor or scheduler.
The core source and checksum remain unchanged.

Each nonempty successful result (including retained historical successes on first
startup) gets a stable `result:<run ID>` fact. The fact binds the originating Bot,
explicit Project/Session target or legacy scope, final successful attempt, and a
SHA-256 digest of the saved payload/result. Notification text comes from the work
ledger, not another transcript copy. Memory replacement jobs and approval-waiting,
failed, cancelled or unknown runs do not become successful-result notifications.
Approval and confirmation-wait state remain in the existing work/approval ledger;
reading a notification never answers an approval.

| Boundary | Meaning and recovery |
| --- | --- |
| Execution success | The result and successful attempt already exist in DurableWorkStore. |
| Event accepted / delivery pending | A durable fact exists; the next host tick or restart can retry inbox admission. |
| Delivered | Core atomically acknowledges the delivery and creates the local inbox receipt, identified by the same event ID. This is local inbox availability, not an OS notification or proof that a person saw it. |
| Read | The user explicitly selects **Mark result read**. Its timestamp is persisted separately; repeated clicks are idempotent. |
| Transcript projection | The existing independent Session bridge still reconciles in ledger order. Delivery/read receipts never suppress transcript verification or append messages. |
| Notification failure | A visible error retains execution success and existing receipts. Retry only inspects saved results and admits receipts; it never enqueues work, calls a model, mutates memory or repeats an external effect. |

A selected conversation shows only its own unseen notifications. Conversation
options show unseen counts, including results completed after switching away;
Companion cards show an aggregate count without another conversation's result
text. The work sidebar and recent-result preview follow the selected conversation.
The existing global Tasks/Home ledger remains an explicit all-context inspection
surface, with captured scope labels. Navigation, opening a result, polling and
relaunching do not imply reading it. Reading validates the Bot, selected Session,
current authoritative membership and immutable source correlation in the main
process. Changed membership is never used to retarget a historical notification.

The result commit and event acceptance remain separate stores. Startup scans
persisted successes to repair an interruption between them. Duplicate facts must
match; changed source data or inconsistent receipts fail closed for inspection.
A poisoned core EventStore after uncertain persistence requires restart/inspection;
it is never force-unlocked. The core 16 MiB event history limit remains in effect;
no automatic history deletion or archival is added. Idle polling does not rewrite
unchanged events or read receipts.

Qualification uses synthetic fixtures: exceptions and real SIGKILL after event
acceptance and after inbox admission; duplicate reconciliation and read commands;
restart with no additional model call or work attempt; cancellation with a late
response; approval waiting; source mismatch; two Projects and separate Sessions;
and repeated UI navigation/restarts without a second transcript entry. Native
and unsigned packaged consumers exercise the same main-process IPC validation.
Real Apple inference remains opt-in and must be reported separately from injected
provider tests. Physical power-loss behavior and platforms beyond local macOS
qualification are not established by these fixtures.

Broader messaging, OS/push delivery, external
sending, shopping integrations, note correction/invalidation and conversation-model
controls (issue #8) remain later work. Existing product hypotheses stay proposed.
Sequential recovery awaits, Promise-returning APIs and the CJS Electron bootstrap
are intentionally retained: ordering and compatibility are correctness requirements,
not opportunities to mechanically parallelize work for static analysis.

Local notification qualification on 2026-11-15 (macOS arm64) passed pinned core
provenance, lint, types, 40 deterministic unit tests, seven native UI tests, build,
unsigned packaging and the packaged Project/Session notification consumer. The
actual Apple inference UI test was skipped; injected provider tests ran. The
[synthetic notification capture](../evidence/local-result-notifications.png) is
produced by `test/ui/project-context.test.ts` using temporary Alpha/Beta Projects
and the built-in weather-capability response, without a model call. CI results
must still be checked against the exact feature-branch commit.

Static analysis follow-up: the initial PR #11 SonarCloud gate passed with no
security hotspots. Optional chaining, read timestamp assignment and nested
rendering in the new notification panel/counts were simplified. S3358/S4624
findings on the pre-existing large Companion-card and main-page templates are
intentionally retained for a separate UI decomposition: rewriting those entire
profile/source/approval surfaces would broaden this durability change. No rule
is suppressed. Windows CI exposed a fixture assertion that assumed POSIX signal
reporting; the fixture now proves checkpoint entry and persisted delivery state
and checks Windows forced-termination status separately, without skipping recovery.

## Durable local approval answers

The local **Approve memory replacement** / **Reject** interaction now persists an
immutable answer in `work.json.answers.json`, using the unchanged pinned core
EventStore. This is a separate app-owned userData store outside Git. The existing
work ledger remains the request, decision, attempt and execution authority. No
new scheduler, execution engine, standing grant or communication provider is added.

The current supported approval action is legacy Bot-memory replacement. Project
notes retain their explicit scoped API; Project/Session memory approvals and
arbitrary future action types are rejected. In particular, Project membership is
never interpreted as permission to replace Bot memory. Answering requires the
Bot's selected context to be **Legacy / unclassified**. A selected Session,
including one whose membership changed, cannot retarget a legacy approval.

The trusted native main-frame IPC handler requires an explicit run ID, Bot,
legacy Session marker, boolean answer and host-issued action token. Tokens bind
the immutable run/request, complete payload, effect and exact preview to the
current Bot revision and expected memory. They are correlation tokens, not bearer
credentials; the existing renderer sender validation remains required. Model
output, notes, transcripts and third-party text do not enter this answer API.
The UI binds the token to the rendered preview. Stale/unsupported proposals show
an explanation and can be cancelled before creating a fresh proposal.

| Boundary | Persisted meaning and recovery |
| --- | --- |
| Accepted | One immutable `answer:<run ID>` fact records the exact boolean response and action digest. Exact retries return the existing receipt; conflicting responses fail. Acceptance alone grants no execution. |
| Admitted | Core atomically acknowledges local consumer delivery with that event ID. This admits a response for consumption; it does not execute the action. |
| Work decision | The host revalidates the still-pending approval, payload, Bot revision and expected memory, then calls the existing core approval API. Cancellation or stale authority prevents applying the saved answer. |
| Consumed | A separate durable marker records `decided`, `stale` or `cancelled`. A restart between the work decision and this marker verifies the saved decision instead of creating another run or reauthorizing it. |
| Execution | New memory proposals require the matching consumed affirmative fact plus the existing work approval and unchanged expected memory/revision. The existing atomic work finish stores the successful attempt and Bot memory together. |

The two stores do not share a database transaction. Recovery reconciles their
stable IDs before claiming work; inconsistent source/decision/receipt evidence
shows an approval-recovery error and pauses new execution. Idle reconciliation
never rewrites consumed facts. A repeated answer after completion acknowledges
the saved response without another attempt. A cancelled run stays cancelled;
an interrupted opaque attempt stays unknown and blocks automatic execution.
No replay of an answer calls a model, changes a transcript, repeats an external
effect or establishes distributed exactly-once delivery. A stale accepted answer
is retained for inspection and cannot become fresh authorization later.

Pre-existing pending memory approvals with expected-memory protection can be
answered through the new boundary. Pre-existing recorded decisions retain their
work-ledger semantics; they are not fabricated into new user-answer events.
New proposals also capture the Bot revision, so even unrelated profile changes
require cancelling/recreating an unanswered proposal. A missing/changed/corrupt
answer store cannot authorize new-format memory work. Existing core file locking,
uncertain-persistence poisoning and the 16 MiB event-history bound remain in force;
there is no reset, force unlock, automatic archival or history deletion.

Qualification uses synthetic approve/reject, exact and conflicting duplicates,
wrong Bot/Session/token, changed profile/memory, cancellation, unsupported scoped
actions, changed membership, corrupt consumption and changed action fixtures.
Exceptions and real child-process SIGKILL cover acceptance, admission, saved work
decision and consumption before restart. Native UI fixtures exercise approve,
reject, an interrupted accepted answer, missing IPC correlation, repeated commands
and relaunch without repeated execution. Actual Apple inference is opt-in and was
not exercised for this stage. Physical power loss, distributed writers and other
native platforms remain unqualified. Broader messaging, scoped approval types,
external file writes and conversation model selection (issue #8) remain follow-up
scope; product hypotheses remain proposed.

Local qualification on 2026-11-15 (macOS arm64) passed core archive/installed
provenance, lint, types, 58 deterministic unit tests, ten native UI tests, build,
unsigned packaging and four packaged approval/Project consumer tests. One actual
Apple inference UI test was skipped. The
[synthetic approval capture](../evidence/local-approval-answer.png) comes from
`test/ui/approval-answers.test.ts` with temporary userData and injected saved
results, without inference. Final PR CI and static-analysis findings must be
assessed against its exact HEAD separately.

Static analysis follow-up: the initial PR #12 analysis reported no security
hotspots but failed the duplicate-line gate (3.6%) on repeated recovery assertions
in two new tests. Those assertions now share one helper. New fixture Error
construction and Playwright length reporting were corrected; the touched header's
existing nested subtitle ternaries were replaced with an explicit template map.
No quality threshold, workflow budget or rule suppression was changed.

## Durable local conversation input

The desktop's local **Send** action now saves a conversation-input fact in
`work.json.messages.json` before work admission. This unchanged pinned core
EventStore is app-owned userData, outside Git. It receives bounded local text;
it is not an externally exposed API, remote authentication service or messaging
integration. Selected-source workflows and recurring jobs retain their existing
preview and scheduler pathways. Previewed local chat uses the same input adapter
and still rejects a stale preview before first acceptance.

The renderer persists an unconfirmed send envelope in its app-owned localStorage
before IPC: stable message ID, Bot, explicit legacy/Session target, exact text and
optional preview token. A successful local receipt clears that envelope and the
matching composer draft. Failed/uncertain acknowledgement retains the original
envelope. After relaunch, **Check saved send receipt** explicitly resends its
original ID/text/target; navigation and startup never submit renderer drafts.
Different text cannot replace an unconfirmed send. A refreshed explicit preview
can update its pre-acceptance preview token while retaining the message ID.
Empty input is rejected before persisting a renderer envelope.

The trusted native main-frame IPC handler requires the explicit conversation
marker. Before accepting a new ID, the host validates the current selection,
Bot association and authoritative Project membership, then rechecks its captured
target after asynchronous validation. The immutable fact retains the original
Bot, Project, Session, membership revision and local provider/model selection.
Exact duplicate ID/body/target receipt requests acknowledge that original fact,
even after a selection change; they do not create authorization or execution.
Conflicting text or a different Bot/Session with the same ID is rejected. Message
text, Project notes and model output cannot answer approvals or grant tools.

| Receipt boundary | Meaning and recovery |
| --- | --- |
| Accepted | The immutable input fact and pending consumer delivery are saved. No work run or model call is implied. |
| Waiting for execution | Core atomically acknowledges consumer delivery with a local admission record. The host then enqueues one read-only work occurrence under `message:<message ID>` and binds its run and core-derived request ID. |
| Running | Existing core work owns one claimed attempt. Nest does not add a worker pool or execution engine. |
| Result saved | Core has persisted the successful attempt and result. Existing Project transcript projection and result notification reconciliation remain independent. |
| Interrupted | Core recovered an interrupted read attempt without a saved result. The adapter cancels its requeued occurrence before another claim; the retained unknown attempt is visible. Only an explicit new message ID can request another inference. |
| Cancelled / failed / unknown | Existing work outcomes remain authoritative. Stop cancels accepted-but-unadmitted inputs too. Repeated receipts never revive these outcomes, and unrelated opaque unknown work still blocks claims. |

Receipt admission never mutates work in the EventStore transaction callback.
Acceptance, admission, core enqueue and binding have separate persistence
boundaries. Restart before binding reconciles the same occurrence/payload rather
than creating a new run. An explicit `nestInputVersion: 1` marker activates the
bridge; unmarked legacy message-like fields remain application data. A saved binding cannot hide a missing run, changed
payload or changed core request ID; inconsistent/missing input evidence pauses
new execution with a visible inspection error. No history is automatically
removed, and core's lock/poisoning behavior and 16 MiB store limit remain intact.
Unchanged idle reconciliation does not rewrite the input store.

A saved result is projected using the existing deterministic run/attempt message
IDs. Receipt replay does not append conversation messages or read a notification.
An accepted input is not immediately inserted as a transcript message; failed,
stopped and interrupted inputs remain inspectable through their receipt/work
records. A later selected Session never retargets queued input; changed membership
fails before inference and cannot move text into another Project.

Qualification uses synthetic fixtures for exact/conflicting receipts, legacy and
Project isolation, wrong/stale context, membership changes, stop before and after
admission, running cancellation with late output, missing/corrupt correlations,
and idle/restart behavior. Real process death covers accepted, admitted, enqueued,
bound, claimed, model-returned and result-saved boundaries, including Project
ownership recovery before/after result persistence. Existing real process-death
fixtures cover partial and complete transcript projection. Native UI fixtures
exercise lost acknowledgement, explicit receipt checks, composer clearing,
conflicting content, stale preview, Session switching and relaunch.

UI captures support `NEST_TEST_EVIDENCE_DIR` so local qualification can write to a
temporary directory without overwriting retained repository screenshots. The CI
default remains `evidence/`; no workflow budget or settings change is needed.
Actual Apple inference remains opt-in and must be reported separately. Physical
power loss, distributed exactly-once execution, remote delivery/authentication,
iOS companions, Google integrations, Project approvals and conversation model
selection (issue #8) remain outside this stage. Existing product hypotheses stay
proposed; result notifications, memory approval and external-write boundaries
remain unchanged.

Local qualification on 2026-11-15 (macOS arm64) passed unchanged core archive
and installed provenance, lint, types, 78 deterministic unit tests, twelve native
UI tests, build, unsigned packaging and six packaged input/approval/Project
consumer tests. Actual Apple inference was skipped. Retained repository PNG
hashes matched before and after qualification; captures went to temporary output.
Final PR CI and detailed Sonar findings must be assessed on its exact HEAD.
