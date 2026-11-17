import { characterColor, type CharacterColor } from "./appearance";
import {
	characterAvatar,
	characterRail,
	appearanceMarkup,
} from "./characters-ui";
import {
	projectNotesMarkup,
	bindProjectNotes,
	capturedNotesMarkup,
} from "./project-notes-ui";
import type { NotesInspection, NoteHistory } from "./project-notes";
import type { ProjectContextSnapshot } from "@cybergarage/orbit/dist/core/projects/memory-context.js";
import {
	pendingInputs,
	prepareInput,
	acknowledgeInput,
	type PendingInput,
} from "./local-input";
import type { MessageReceipt } from "./conversation-input";
import type { ApprovalRequest } from "./approval-answers";
import type { ResultNotice } from "./notifications";
import { capturedContext } from "./context-target";
import { emptyLife, remaining, type LifeState, type Template } from "./life";
import type {
	ScheduledRun,
	WorkState,
} from "@cybergarage/orbit/dist/core/execution/scheduled-work.js";
import {
	companionActivity,
	scopeLabel,
	STATUS_LABELS,
	type WorkflowPreview,
} from "./workflow";
import type { ModelCatalog } from "./models";
import type { Bot } from "./runtime";

declare global {
	interface Window {
		nest: {
			call(
				command: string,
				input?: unknown,
			): Promise<
				| WorkState
				| string
				| string[]
				| WorkflowPreview
				| ModelCatalog
				| NoteHistory
			>;
		};
	}
}
let state: WorkState;
let view = localStorage.getItem("nest.view.v1") ?? "home";
let appearance: { botId: string; color: CharacterColor } | undefined;
let editing = false;
let botMenu: string | undefined;
let panel = "";
let returnFocus = "";
const panelNames: Record<string, string> = {
	conversations: "Conversation history",
	projects: "Projects & notes",
	tasks: "Tasks & recurring jobs",
	settings: "Bot settings, name & memory",
	focus: "Focus & keepsakes",
};
const contextTools = new Map<string, boolean>();
const workFilterPanels = new Map<string, boolean>();
const receiptPanels = new Map<string, boolean>();
const drafts = new Map<string, Record<string, string>>();
const revisions = new Map<string, number>();
const inventories = new Map<string, string[]>();
let health = "Checking local providers…";
let catalog: ModelCatalog | undefined;
let checkingModels = false;
const modelDrafts = new Map<string, { provider: string; model: string }>();
let error = "";
let filter = "all";
let owner = "all";
const addRequests = new Map<string, string>();
const focusDrafts = new Map<
	string,
	{ step: string; progress: string; nextStep: string }
>();
const proposals = new Map<
	string,
	{ preview: WorkflowPreview; requestId: string }
>();
const tasks = new Map<
	string,
	{ prompt: string; mode: string; minutes: string }
>();
const pending = new Set<string>();
const manualRequests = new Map<string, string>();
const root = document.querySelector<HTMLDivElement>("#app") as HTMLDivElement;
const htmlText = (value: unknown): string =>
	String(value ?? "").replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				c
			] ?? c,
	);
async function call(command: string, input: unknown = {}): Promise<void> {
	const key = `${command}:${(input as { id?: string }).id ?? ""}`;
	const actionScope = conversationKey((input as { id?: string }).id ?? "");
	if (pending.has(key)) return;
	pending.add(key);
	try {
		await window.nest.call(command, input);
		if (
			command === "focus" &&
			["start", "close"].includes(String((input as { action?: string }).action))
		)
			focusDrafts.delete((input as { id: string }).id);
		if (command === "chat") {
			const sent = input as PendingInput;
			acknowledgeInput(localStorage, sent.requestId);
			const draft = tasks.get(conversationKey(sent.id, sent.sessionId));
			if (draft?.prompt === sent.prompt)
				tasks.set(conversationKey(sent.id, sent.sessionId), {
					...draft,
					prompt: "",
				});
			proposals.delete(conversationKey(sent.id, sent.sessionId));
		}
		if (command === "run" || command === "schedule")
			proposals.delete(actionScope);
		if (command === "run-routine")
			manualRequests.delete((input as { id: string }).id);
		if (
			[
				"save",
				"select-files",
				"folder",
				"revoke-folder",
				"select-model",
			].includes(command)
		)
			editing = false;
		if (command === "folder" || command === "revoke-folder")
			inventories.delete((input as { id: string }).id);
		if (command === "select-model") {
			modelDrafts.delete((input as { id: string }).id);
			proposals.delete(actionScope);
		}
		if (command === "save") {
			const id = (input as { id: string }).id;
			drafts.delete(id);
			revisions.delete(id);
		}
		error = "";
		await refresh();
		render();
	} catch (e) {
		error = e instanceof Error ? e.message : String(e);
		if (
			["run", "schedule", "chat"].includes(command) &&
			error.includes("changed")
		)
			proposals.delete(actionScope);
		render();
	} finally {
		pending.delete(key);
	}
}
function template(bot: Bot): Template {
	return (
		bot.template ??
		(bot.id === "documents"
			? "writing"
			: bot.id === "research"
				? "research"
				: "custom")
	);
}
function color(botId: string): CharacterColor {
	return characterColor(state?.data.botAppearance, botId);
}
function avatar(bot: Bot, large = false): string {
	return characterAvatar(color(bot.id ?? ""), large);
}
function conversationKey(
	botId: string,
	sessionId = contextView(botId).selected,
): string {
	return JSON.stringify([botId, sessionId]);
}
function recipient(botId: string): string {
	const context = contextView(botId);
	const session = context.sessions.find(
		(item) => item.sessionId === context.selected,
	);
	if (!session) return "Legacy / unclassified";
	const project = context.projects.find(
		(item) => item.id === session.projectId,
	);
	return `${project?.name ?? "Unavailable Project"} / ${session.name}`;
}
function conversationLinks(bot: Bot): string {
	const context = contextView(bot.id);
	const disabled = pending.has(`context-select:${bot.id}`) ? "disabled" : "";
	const links = [
		{ sessionId: "", name: "Legacy / unclassified", projectId: "" },
		...context.sessions,
	];
	const rows = links
		.map((session) => {
			const project = context.projects.find(
				(item) => item.id === session.projectId,
			);
			return `<button class="conversation-link" data-session="${htmlText(session.sessionId)}" aria-pressed="${context.selected === session.sessionId}" ${disabled}><strong>${htmlText(project?.name ?? "Bot history")}</strong><span>${htmlText(session.name)}</span><small data-session-unread="${htmlText(session.sessionId)}">${unseen(bot.id, session.sessionId)} unseen</small></button>`;
		})
		.join("");
	return `<div class="conversation-links"><h2>${htmlText(bot.name)}</h2><p>Pick a conversation. Keep its Project context.</p>${rows}</div>`;
}
function navigate(next: string): void {
	view = next;
	botMenu = undefined;
	panel = "";
	filter = "all";
	localStorage.setItem("nest.view.v1", view);
	appearance = undefined;
	error = "";
	editing = false;
	render();
}
function selectConversation(botId: string, sessionId: string): void {
	if (pending.has(`context-select:${botId}`)) return;
	editing = false;
	panel = "";
	botMenu = undefined;
	filter = "all";
	proposals.delete(conversationKey(botId));
	const operation = call("context-select", { id: botId, sessionId });
	render();
	void operation.finally(() => render());
}

function life(bot: Bot): LifeState {
	return (
		(state.data.life as Record<string, LifeState> | undefined)?.[bot.id] ??
		emptyLife()
	);
}
function focusMarkup(bot: Bot): string {
	const saved = life(bot),
		s = saved.session;
	const time = s ? remaining(s) : 25 * 60_000;
	return `<section class="focus-panel"><h2>One small step</h2>${s && s.status !== "closed" ? `<p><strong>${htmlText(s.step)}</strong></p><span class="badge" data-focus-status>${s.status === "paused" ? "Paused" : time === 0 ? "Time elapsed · progress unverified" : "Quiet focus"}</span><p class="focus-time" data-timer>${Math.floor(time / 60000)}:${String(Math.floor(time / 1000) % 60).padStart(2, "0")}</p><div class="row"><button data-focus="${s.status === "paused" ? "resume" : "pause"}" ${s.status === "paused" && time === 0 ? "disabled" : ""}>${s.status === "paused" ? "Resume focus" : "Pause focus"}</button></div><label>Your progress or break note<textarea id="progress" maxlength="2000" placeholder="I drafted a transition, or I chose to take a break."></textarea></label><label>Next small step<input id="next-step" maxlength="2000" placeholder="Reread the transition"></label><button data-focus="close">Finish / take a break & leave a note</button>` : `<label>Choose one small step<input id="focus-step" maxlength="2000" placeholder="Write one transition into section two"></label><button data-focus="start">Start quiet focus</button>${s ? `<p class="muted">Reported by you: ${htmlText(s.progress || "Session deliberately stopped.")}</p><p>Next step: ${htmlText(s.nextStep || "Choose when you return.")}</p>` : ""}`}${
		saved.history?.length
			? `<details><summary>Previous progress reports · ${saved.history.length}</summary>${saved.history
					.slice()
					.reverse()
					.map(
						(h) =>
							`<article><h3>${htmlText(h.step)}</h3><p>Reported by you: ${htmlText(h.progress || "Deliberately stopped")}</p><p>Next step: ${htmlText(h.nextStep || "Not provided")}</p></article>`,
					)
					.join("")}</details>`
			: ""
	}<p class="muted">The timer measures your session. It never verifies task completion or runs an agent task.</p></section>`;
}
function nurturingMarkup(bot: Bot): string {
	const saved = life(bot);
	return `<section class="nurturing"><h2>Moku's quiet home</h2><label class="row"><input type="checkbox" id="nurturing" ${saved.enabled ? "checked" : ""}>Optional keepsakes</label>${saved.enabled ? `<div class="quiet-home">${avatar(bot, true)}<div>${saved.placed.map((d) => `<span class="decoration">${d === "leaf cushion" ? "🍃" : d === "acorn" ? "🌰" : "🪴"} ${htmlText(d)}</span>`).join("")}</div></div><p>${saved.awards.length} / 2 acknowledgements for ${htmlText(saved.day || "today")} (UTC).</p>${saved.decorations.map((d) => `<button class="secondary" data-decoration="${d}" data-placed="${!saved.placed.includes(d)}">${saved.placed.includes(d) ? "Remove" : "Place"} ${d}</button>`).join("") || "<p>Choose a step or leave a stop note to collect your first keepsake.</p>"}` : "<p>A calm companion without a care chore. Enable keepsakes if you want a few optional decorations.</p>"}<p class="muted">One start and one deliberate closure per UTC day. No hour rewards, neglect or loss after absence. Keepsakes do not prove work was completed.</p></section>`;
}
function routineMarkup(id?: string): string {
	const list = state.schedules.filter(
		(s) => !id || (s.payload as { botId: string }).botId === id,
	);
	return `<p>${list.length} recurring jobs · ${list.filter((s) => !s.paused).length} enabled · ${list.filter((s) => s.paused).length} paused</p>${
		list
			.map((s) => {
				const p = s.payload as { botId: string; prompt: string },
					bot = bots().find((b) => b.id === p.botId);
				return `<section class="routine"><strong>${htmlText(bot?.name ?? "Unknown Bot")}</strong><h3>${htmlText(p.prompt)}</h3><p class="scope">Captured scope: ${htmlText(scopeLabel(s.payload))}</p><p>${s.paused ? "Paused · no next run" : `Next due: ${new Date(s.next).toLocaleString()}${s.next < Date.now() ? " · late" : ""}`}</p><div class="row"><button class="secondary" data-run-routine="${s.id}">Run now</button><button class="secondary" data-pause="${s.id}" data-paused="${!s.paused}">${s.paused ? "Resume" : "Pause"}</button></div></section>`;
			})
			.join("") ||
		'<p class="muted">No recurring jobs. Preview and confirm a routine with a Bot to create one.</p>'
	}<p class="muted">Runs need Nest running and the device awake. Closing the window keeps Nest running; Quit, sleep or poweroff prevents execution. Missed intervals coalesce into one latest occurrence.</p>`;
}
function ownerFilter(): string {
	return `<label>Bot owner<select id="owner-filter"><option value="all">All Bots</option>${bots()
		.map(
			(b) =>
				`<option value="${b.id}" ${owner === b.id ? "selected" : ""}>${htmlText(b.name)}</option>`,
		)
		.join("")}</select></label>`;
}
function libraryMarkup(): string {
	return `<p>Choose a starting role, then make it your own. Added Bots start without source permissions, memory or a selected model.</p><div class="companion-grid">${(["moku", "writing", "research", "custom"] as Template[]).map((t) => `<section class="companion-card">${avatar({ template: t } as Bot, true)}<h2>${t === "moku" ? "Moku" : t === "writing" ? "Writing companion" : t === "research" ? "Research companion" : "Personal Bot"}</h2><p>${t === "moku" ? "Choose a small step, focus quietly and return after interruptions." : t === "writing" ? "Explicitly selected local manuscripts, read only." : t === "research" ? "Explicit approved public page, read only." : "Your own profile for local conversation."}</p><button data-add="${t}">Add ${t === "moku" ? "Moku" : t === "custom" ? "personal Bot" : `${t} Bot`}</button></section>`).join("")}</div><h2>Your Bots</h2>${companionCards()}`;
}
function pluginsMarkup(): string {
	return `<section><h2>Shared tools, explicit Bot scope</h2><p>Local conversation, manuscript reading and approved public-page reading reuse the existing bounded runtime. Source grants belong to individual Bots; profiles cannot grant folders.</p>${bots()
		.map(
			(b) =>
				`<article class="tool-row"><strong>${htmlText(b.name)}</strong><p>Local chat · ${htmlText(b.model || "select a model first")}</p><p>${template(b) === "writing" ? `Manuscripts · ${b.folder ? "folder granted" : "no folder granted"} · ${b.selectedFiles?.length ?? 0} selected files` : template(b) === "research" ? `Approved public page · ${htmlText(b.page || "no page selected")}` : "Local chat only · no source-read capability"}</p><p>Memory replacement · exact approval required</p><button data-view="${b.id}">Review ${htmlText(b.name)} permissions</button></article>`,
		)
		.join(
			"",
		)}</section><section><h2>Gmail · unavailable</h2><p>Not connected. No OAuth, credentials, message reading, drafts or sending are implemented.</p><div class="row"><button disabled>Connect Gmail · unavailable</button><button disabled>Read · unavailable</button><button disabled>Draft · unavailable</button><button disabled>Send · unavailable</button></div><p>All Bot access is denied. A future provider integration needs a separate credential and approval boundary.</p></section>`;
}

const bots = (): Bot[] => state.data.bots as Bot[];
function inputReceiptsOpen(botId: string, sessionId: string): boolean {
	if (receiptPanels.get(conversationKey(botId, sessionId))) return true;
	try {
		return pendingInputs(localStorage).some(
			(input) => input.id === botId && input.sessionId === sessionId,
		);
	} catch {
		return true;
	}
}
function localInputMarkup(botId: string): string {
	const sessionId = contextView(botId).selected;
	const receipts = (
		(state.data.messageReceipts ?? []) as MessageReceipt[]
	).filter(
		(message) => message.botId === botId && message.sessionId === sessionId,
	);
	const inputLabels: Record<MessageReceipt["status"], string> = {
		accepted: "Accepted",
		waiting: "Waiting for execution",
		running: "Running",
		"result-saved": "Result saved",
		failed: "Failed",
		cancelled: "Cancelled",
		interrupted: "Interrupted · new send required",
		unknown: "Unknown · inspection required",
	};
	const rows = receipts
		.slice(-20)
		.reverse()
		.map(
			(message) =>
				`<article class="result"><strong>Input: ${htmlText(inputLabels[message.status])}</strong><p>${htmlText(message.prompt)}</p><small>Message ${htmlText(message.id)} · ${htmlText(scopeLabel(message.task))}</small></article>`,
		)
		.join("");
	let unconfirmed = "";
	try {
		const pending = pendingInputs(localStorage).find(
			(input) => input.id === botId && input.sessionId === sessionId,
		);
		if (pending)
			unconfirmed = `<p>Receipt unconfirmed. This saved send retains its original text and conversation.</p><pre>${htmlText(pending.prompt)}</pre><button id="retry-local-input">Check saved send receipt</button>`;
	} catch (error) {
		unconfirmed = `<p role="alert">${htmlText(error instanceof Error ? error.message : error)}</p>`;
	}
	return `<section aria-label="Received local inputs"><h2>Local input receipts</h2><p class="muted">Accepted means saved locally. Execution and result saving are separate. Interrupted inputs require an explicit new send; receipts never authorize tools or memory changes.</p>${unconfirmed}${rows || "<p>No received inputs in this conversation.</p>"}</section>`;
}
function bindLocalInputRetry(botId: string): void {
	const retry = document.getElementById("retry-local-input");
	if (retry)
		retry.onclick = () => {
			try {
				const input = pendingInputs(localStorage).find(
					(input) =>
						input.id === botId &&
						input.sessionId === contextView(botId).selected,
				);
				if (input) void call("chat", input);
			} catch (e) {
				error = e instanceof Error ? e.message : String(e);
				render();
			}
		};
}
function approvalMarkup(run: ScheduledRun): string {
	if (!run.approval || run.status !== "approval") return "";
	const request = (
		state.data.approvalRequests as ApprovalRequest[] | undefined
	)?.find((request) => request.id === run.id);
	const preview = `<p>Approval required before local memory replacement. Exact planned change:</p><pre>${htmlText(run.approval.preview)}</pre>`;
	if (!request)
		return `${preview}<p>This approval is stale or unsupported. Cancel it and create a fresh proposal from the saved result.</p>`;
	const binding = `data-approval-token="${htmlText(request.token)}" data-bot-id="${htmlText(request.botId)}"`;
	return `${preview}<p class="muted">Answer only in Legacy / unclassified for this Bot. A response applies to this exact proposal once.</p><button data-approve="${htmlText(run.id)}" ${binding}>Approve memory replacement</button><button class="secondary" data-deny="${htmlText(run.id)}" ${binding}>Reject</button>`;
}
function noteEvidence(run: ScheduledRun): string {
	const target = capturedContext(run.payload);
	if (!target) return "";
	const snapshot = (
		state.data.contextEvidence as
			| Record<string, ProjectContextSnapshot>
			| undefined
	)?.[run.id];
	if (!snapshot) return "";
	if (
		snapshot.projectId !== target.projectId ||
		snapshot.sessionId !== target.sessionId ||
		snapshot.membershipRevision !== target.membershipRevision
	)
		return '<p role="alert">Captured Project note context needs inspection.</p>';
	return capturedNotesMarkup(snapshot);
}
function card(run: ScheduledRun): string {
	const p = run.payload as {
		botId?: string;
		prompt?: string;
		kind?: string;
		context?: unknown;
		nestContextVersion?: number;
	};
	const bot = bots().find((b) => b.id === p.botId);
	const evidence = (
		state.data.modelEvidence as
			| Record<string, { provider: string; model: string; execution: string }>
			| undefined
	)?.[run.id];
	const receipt =
		run.status === "succeeded" &&
		typeof run.result === "string" &&
		run.result.length > 0;
	return `<article class="result" id="run-${htmlText(run.id)}" data-status="${run.status}" tabindex="-1">
 <div class="row"><strong>${htmlText(bot?.name ?? "Companion")}</strong><span class="badge ${run.status}">${STATUS_LABELS[run.status]}</span></div>
 <h3>${htmlText(p.prompt ?? "Local memory replacement")}</h3>${evidence ? `<p>Recorded model attempt: Local · ${htmlText(evidence.provider)} / ${htmlText(evidence.model)}</p>` : ""}<p class="scope">Captured scope: ${htmlText(scopeLabel(run.payload))}</p>
 ${approvalMarkup(run)}
 ${run.result ? `<details class="receipt" ${receipt ? "open" : ""}><summary>${receipt ? "Saved result receipt" : "Saved execution outcome"}</summary><pre>${htmlText(run.result)}</pre></details>` : run.status === "succeeded" ? "<p>No result text is attached to this completed record. Inspect execution evidence below.</p>" : ""}
 ${receipt && p.prompt && p.nestContextVersion !== 1 ? `<button class="secondary" data-remember="${htmlText(run.id)}">Review saving to memory</button>` : ""}
 ${["queued", "running", "approval"].includes(run.status) ? `<button class="secondary" data-cancel="${htmlText(run.id)}">${run.status === "running" ? "Request stop" : "Cancel"}</button><p class="muted">${run.effect === "read" ? "Stopping is cooperative; a local model may continue computing briefly. Cancelled output cannot be saved as a completed result." : "An interrupted operation with an uncertain effect is marked unknown; stopping does not prove it was undone."}</p>` : ""}
 ${run.status === "unknown" ? `<p>Outcome unresolved. Automatic replay is blocked. Inspect this record before confirming the operation stopped; this does not undo an effect.</p><button class="secondary" data-reconcile="${htmlText(run.id)}">Confirm stopped and close unresolved work</button>` : ""}
 <details><summary>Execution evidence</summary><small>Run ${htmlText(run.id)}<br>Occurrence ${htmlText(run.occurrenceId)}<br>Request ${htmlText(run.requestId)}<br>Persisted status: ${run.status}<br>${
		state.attempts
			.filter((a) => a.runId === run.id)
			.map((a) => `${htmlText(a.id)} · ${htmlText(a.status)}`)
			.join("<br>") || "No attempt has started."
 }</small></details>${noteEvidence(run)}</article>`;
}
interface ContextView extends NotesInspection {
	projects: { id: string; name: string }[];
	sessions: { projectId: string; sessionId: string; name: string }[];
	selected: string;
}
const contextOperations = new Map<string, string>();
function contextView(botId: string): ContextView {
	return (
		(state.data.contextViews as Record<string, ContextView> | undefined)?.[
			botId
		] ?? { projects: [], sessions: [], selected: "", notes: [], inactive: [] }
	);
}
function notices(botId: string, sessionId?: string): ResultNotice[] {
	return ((state.data.resultNotices ?? []) as ResultNotice[]).filter(
		(n) =>
			n.botId === botId &&
			(sessionId === undefined || (n.target?.sessionId ?? "") === sessionId),
	);
}
function unseen(botId: string, sessionId?: string): number {
	return notices(botId, sessionId).filter((n) => !n.read).length;
}
function unseenSuffix(botId: string, sessionId: string): string {
	const count = unseen(botId, sessionId);
	return count ? ` · ${count} unseen` : "";
}
function notificationRow(notice: ResultNotice): string {
	const readButton =
		notice.delivery === "delivered"
			? `<button class="secondary" data-notification-read="${htmlText(notice.id)}">Mark result read</button>`
			: "";
	const label =
		notice.delivery === "pending"
			? "Delivery pending"
			: "Saved result available";
	return `<p data-notice="${htmlText(notice.id)}">${label} <button class="secondary" data-receipt="${htmlText(notice.runId)}">Open saved result</button>${readButton}</p>`;
}
function notificationMarkup(botId: string): string {
	const rows = notices(botId, contextView(botId).selected)
		.filter((notice) => !notice.read)
		.map(notificationRow)
		.join("");
	const count = unseen(botId, contextView(botId).selected);
	return `<section aria-label="Local result notifications"><h2>Unseen results · ${count}</h2>${rows}<details><summary>About saved results</summary><p class="muted">Opening a conversation does not mark results read. Delivery and read receipts are separate from execution and approval.</p></details></section>`;
}
function contextMarkup(botId: string): string {
	const context = contextView(botId);
	const sessionOptions = context.sessions
		.map((session) => {
			const projectName =
				context.projects.find((project) => project.id === session.projectId)
					?.name ?? "Unavailable Project";
			const selected = session.sessionId === context.selected ? "selected" : "";
			return `<option value="${htmlText(session.sessionId)}" ${selected}>${htmlText(projectName)} / ${htmlText(session.name)}${unseenSuffix(botId, session.sessionId)}</option>`;
		})
		.join("");
	const projectOptions = context.projects
		.map(
			(project) =>
				`<option value="${htmlText(project.id)}">${htmlText(project.name)}</option>`,
		)
		.join("");
	const notes = context.selected ? projectNotesMarkup(context) : "";
	const hint = context.selected
		? "Only this conversation and its Project notes reach the local model. Legacy Bot memory and other conversations are excluded. Project mode currently supports local chat only."
		: "Existing history, memory and routines remain unclassified. Selecting a Project does not import or move them.";
	const createDisabled = context.projects.length ? "" : "disabled";
	return `<section aria-label="Project conversations"><h2>Project conversations</h2><label>Conversation context<select id="context-session" aria-label="Conversation context"><option value="">Legacy / unclassified · Bot history and memory${unseenSuffix(botId, "")}</option>${sessionOptions}</select></label><p class="muted">${hint}</p><details><summary>Create Project or conversation</summary><label>New Project name<input id="project-name" maxlength="100"></label><button class="secondary" id="project-create">Create Project</button><label>Project for new conversation<select id="conversation-project">${projectOptions}</select></label><label>New conversation name<input id="conversation-name" maxlength="100"></label><button class="secondary" id="session-create" ${createDisabled}>Create conversation</button></details>${notes}</section>`;
}

function displayedSession(payload: unknown): string {
	try {
		return capturedContext(payload)?.sessionId ?? "";
	} catch {
		return "";
	}
}
function activity(): string {
	const runs = state.runs
		.filter((r) =>
			bots().some((b) => b.id === view)
				? (r.payload as { botId?: string }).botId === view &&
					displayedSession(r.payload) === contextView(view).selected
				: owner === "all" || (r.payload as { botId?: string }).botId === owner,
		)
		.slice()
		.reverse();
	const filters = ["all", ...Object.keys(STATUS_LABELS)];
	const buttons = filters
		.map(
			(key) =>
				`<button class="secondary" data-filter="${key}" aria-pressed="${filter === key}">${key === "all" ? "All work" : STATUS_LABELS[key as keyof typeof STATUS_LABELS]} (${runs.filter((r) => key === "all" || r.status === key).length})</button>`,
		)
		.join("");
	const filterMarkup = `<div class="filters" role="group" aria-label="Task states">${buttons}</div><p class="muted">Statuses come from persisted Orbit work records. Completion wording in chat is not proof of execution.</p>`;
	const scoped = bots().some((bot) => bot.id === view);
	const filterOpen = workFilterPanels.get(conversationKey(view)) ? "open" : "";
	const controls = scoped
		? `<details class="work-filters" data-scope="${htmlText(conversationKey(view))}" ${filterOpen}><summary>Work states</summary>${filterMarkup}</details>`
		: filterMarkup;
	return `${controls}${
		runs
			.filter((r) => filter === "all" || r.status === filter)
			.map(card)
			.join("") ||
		'<section class="empty">No work in this state. Preview a task with a Companion to begin.</section>'
	}`;
}
function companionCards(): string {
	const ordered = bots()
		.slice()
		.sort(
			(a, b) => Number(template(b) === "moku") - Number(template(a) === "moku"),
		);
	return `<p class="stats-inline">${bots().length} Bots · ${state.runs.filter((r) => ["queued", "running"].includes(r.status)).length} active model tasks · ${state.runs.filter((r) => r.status === "approval").length} awaiting approval</p><div class="companion-grid">${ordered
		.map((bot) => {
			const current = companionActivity(
					state,
					bot.id,
					contextView(bot.id).selected,
				),
				session = template(bot) === "moku" ? life(bot).session : undefined;
			const jobs = state.schedules.filter(
				(s) => (s.payload as { botId?: string }).botId === bot.id,
			);
			const next = jobs
				.filter((s) => !s.paused)
				.sort((a, b) => a.next - b.next)[0];
			return `<article class="companion-card">${avatar(bot, true)}<h2>${htmlText(bot.name)}</h2><p>${unseen(bot.id)} unseen saved result(s)</p><p>${template(bot) === "moku" ? "Quiet focus companion" : template(bot) === "writing" ? "Selected-manuscript reader" : template(bot) === "research" ? "Selected-page reader" : "Your personal conversation companion"}</p><h3>Current work</h3>${session ? `<p><span class="badge">Focus · ${session.status}</span> ${htmlText(session.step)}</p><p class="muted">Reported by you: ${htmlText(session.progress || "No progress reported")}</p>` : ""}${current.active.map((r) => `<p><span class="badge ${r.status}">${STATUS_LABELS[r.status]}</span> ${htmlText((r.payload as { prompt?: string }).prompt ?? "Memory replacement")}</p>`).join("")}${!session && !current.active.length ? '<p class="muted">Ready when you are.</p>' : ""}${current.unresolved.length ? `<p class="badge unknown">${current.unresolved.length} unresolved interrupted operation(s)</p>` : ""}<h3>Next recurring job</h3><p>${next ? new Date(next.next).toLocaleString() : "None enabled"} · ${jobs.filter((s) => s.paused).length} paused</p>${current.recentResult ? `<details><summary>Recent saved result</summary><p>${htmlText(current.recentResult.result?.slice(0, 220))}</p></details><button class="secondary" data-receipt="${current.recentResult.id}">Open saved result</button>` : ""}<div class="actions"><button data-view="${bot.id}">Open Companion</button><button class="secondary" data-stop-companion="${bot.id}">Stop this Companion</button></div></article>`;
		})
		.join(
			"",
		)}</div><p class="muted">Stop pauses only this Bot's recurring jobs and cancels its queued/running/approval work. Unknown outcomes remain visible.</p>`;
}
function bindWorkActions(): void {
	const commands: Record<string, [string, object]> = {
		approve: ["approve", { allow: true }],
		deny: ["approve", { allow: false }],
		cancel: ["cancel", {}],
		remember: ["remember", {}],
		reconcile: ["reconcile", {}],
		"stop-companion": ["stop-companion", {}],
		pause: ["pause", {}],
		"run-routine": ["run-routine", {}],
	};
	for (const [attribute, [command, extra]] of Object.entries(commands))
		for (const b of root.querySelectorAll<HTMLButtonElement>(
			`[data-${attribute}]`,
		))
			b.onclick = () => {
				const id = b.getAttribute(`data-${attribute}`) ?? "";
				b.disabled = true;
				const input = {
					id,
					...(command === "approve"
						? {
								botId: b.dataset.botId,
								sessionId: "",
								token: b.dataset.approvalToken,
							}
						: {}),
					...extra,
					...(command === "pause"
						? { paused: b.dataset.paused === "true" }
						: {}),
					...(command === "run-routine"
						? {
								requestId:
									manualRequests.get(id) ??
									(() => {
										const value = crypto.randomUUID();
										manualRequests.set(id, value);
										return value;
									})(),
							}
						: {}),
				};
				void call(command, input);
			};
	for (const b of root.querySelectorAll<HTMLButtonElement>("[data-filter]"))
		b.onclick = () => {
			filter = b.dataset.filter ?? "all";
			renderActivity();
		};
	for (const b of root.querySelectorAll<HTMLButtonElement>(
		"[data-notification-read]",
	))
		b.onclick = () =>
			void call("notification-read", {
				id: b.dataset.notificationRead,
				botId: view,
				sessionId: contextView(view).selected,
			});
	for (const b of root.querySelectorAll<HTMLButtonElement>("[data-receipt]"))
		b.onclick = () => {
			filter = "all";
			renderActivity();
			const run = document.getElementById(`run-${b.dataset.receipt}`);
			run?.scrollIntoView({ block: "start" });
			run?.focus();
		};
}
function rememberWorkFilters(): void {
	const panel = root.querySelector<HTMLDetailsElement>(".work-filters");
	if (panel?.dataset.scope)
		workFilterPanels.set(panel.dataset.scope, panel.open);
}
function renderActivity(): void {
	rememberWorkFilters();
	const messages = document.getElementById("messages");
	const bot = bots().find((item) => item.id === view);
	if (messages && bot) {
		const bottom =
			messages.scrollHeight - messages.scrollTop - messages.clientHeight < 48;
		messages.innerHTML = messagesMarkup(bot);
		if (bottom) messages.scrollTop = messages.scrollHeight;
		for (const button of messages.querySelectorAll<HTMLButtonElement>(
			"[data-work]",
		))
			button.onclick = () => {
				panel = "tasks";
				editing = true;
				render();
				document.getElementById(`run-${button.dataset.work}`)?.focus();
			};
	}
	const focused = (document.activeElement as HTMLElement)?.getAttribute(
		"data-filter",
	);
	const target = document.getElementById("activity");
	if (target) target.innerHTML = activity();
	const inbox = document.getElementById("local-result-notifications");
	if (inbox) inbox.innerHTML = notificationMarkup(view);
	const inputReceipts = document.getElementById("local-input-receipts");
	if (inputReceipts) {
		inputReceipts.innerHTML = localInputMarkup(view);
		bindLocalInputRetry(view);
	}
	for (const option of root.querySelectorAll<HTMLOptionElement>(
		"#context-session option",
	)) {
		const count = unseen(view, option.value);
		option.textContent =
			(option.textContent ?? "").replace(/ · \d+ unseen$/, "") +
			(count ? ` · ${count} unseen` : "");
	}

	for (const element of root.querySelectorAll<HTMLElement>(
		"[data-bot-unread]",
	)) {
		const count = unseen(element.dataset.botUnread ?? "");
		element.textContent = count
			? `${count} unseen`
			: element.dataset.botUnread === view
				? "Selected"
				: "";
	}
	for (const element of root.querySelectorAll<HTMLElement>(
		"[data-session-unread]",
	))
		element.textContent = `${unseen(view, element.dataset.sessionUnread ?? "")} unseen`;

	bindWorkActions();
	if (focused)
		root
			.querySelector<HTMLButtonElement>(`[data-filter="${focused}"]`)
			?.focus({ preventScroll: true });
}
function proposalMarkup(id: string): string {
	const proposal = proposals.get(id);
	return proposal
		? `<article class="proposal"><span class="badge">Proposal · not submitted</span><h3>Planned action</h3><p><strong>Execution:</strong> ${htmlText(proposal.preview.execution)}</p><p>${htmlText(proposal.preview.action)}</p><p><strong>Selected scope:</strong> ${htmlText(proposal.preview.scope)}</p><p><strong>Task:</strong> ${htmlText(proposal.preview.prompt)}</p><p class="muted">${htmlText(proposal.preview.limits)}</p><p class="muted">Preview is not execution evidence and is not saved as a run. Files may change before capture; the result reports what was actually read. Profile/source changes require a fresh preview.</p></article>`
		: '<p class="muted">Local chat sends directly. Source tasks and recurring jobs require a preview before confirmation.</p>';
}
function modelOptions(provider: string, saved: string): string {
	if (provider === "apple")
		return '<option value="system">Apple system · text chat only</option>';
	const models = catalog?.ollama.models ?? [];
	return `<option value="">Choose an installed text model</option>${saved && !models.some((m) => m.name === saved) ? `<option value="${htmlText(saved)}" selected disabled>${htmlText(saved)} · unavailable in current inventory</option>` : ""}${models.map((m) => `<option value="${htmlText(m.name)}" ${m.name === saved ? "selected" : ""} ${m.chat === false ? "disabled" : ""}>${htmlText(m.name)}${m.chat === false ? " · embedding-only" : m.chat === null ? " · capability unreported" : ""}</option>`).join("")}`;
}
function modelSetup(bot: Bot): string {
	const draft = modelDrafts.get(bot.id) ?? {
		provider: bot.provider ?? "ollama",
		model: bot.model,
	};
	return `<section class="model-setup"><h2>Local model setup</h2><p>Saved execution: <strong>Local · ${htmlText(bot.provider ?? "ollama")} / ${htmlText(bot.model)}</strong></p><p>${htmlText(catalog?.ollama.message ?? "Checking installed local models…")}</p><p>${htmlText(catalog?.apple.message ?? "Checking optional Apple text chat…")}</p><p class="muted">Changing provider/model stops this Companion’s queued/running model tasks and preserves memory approvals. Saved routines retain their captured model; recreate them after a change. Cloud execution is not configured. Saving a provider is explicit; Nest never automatically switches providers, downloads a model or enables Apple Intelligence automatically.</p><div class="row"><label>Execution provider<select id="provider"><option value="ollama" ${draft.provider === "ollama" ? "selected" : ""}>Local · Ollama</option><option value="apple" ${draft.provider === "apple" ? "selected" : ""} ${catalog?.apple.available ? "" : "disabled"}>Local · Apple (text chat only)</option><option disabled>Cloud · not configured</option></select></label><label>Installed model<select id="model">${modelOptions(draft.provider, draft.model)}</select></label><button id="select-model">Save model selection</button><button class="secondary" id="check-models" ${checkingModels ? "disabled" : ""}>Check available models</button></div>${bot.provider === "apple" ? "<p>Apple supports text chat only. Manuscript/public-page workflows require an explicit Ollama selection; source tasks are blocked before enqueue. No tools, JSON formatting or streaming.</p>" : ""}</section>`;
}
async function checkModels(): Promise<void> {
	if (checkingModels) return;
	checkingModels = true;
	try {
		catalog = (await window.nest.call("catalog")) as ModelCatalog;
		health = `Ollama: ${catalog.ollama.status === "ready" ? "connected" : catalog.ollama.status === "empty" ? "connected, no models" : catalog.ollama.status === "error" ? "inventory error" : "not reachable"}. Apple: ${catalog.apple.available ? "available, text chat only" : "unavailable"}. Open a Companion for setup guidance.`;
		error = "";
	} catch {
		health =
			"Could not inspect local providers. Check the existing service and retry; no fallback.";
		error = health;
	} finally {
		checkingModels = false;
		render();
	}
}
function alertMarkup(message: unknown, prefix = "", suffix = ""): string {
	if (!message) return "";
	return `<p role="alert" class="error">${htmlText(prefix)}${htmlText(message)}${htmlText(suffix)}</p>`;
}
function sourceModeOption(bot: Bot): string {
	const kind = template(bot);
	if (kind === "writing")
		return '<option value="writing-review">Review selected manuscripts</option>';
	if (kind === "research")
		return '<option value="summary">Check selected public page</option>';
	return "";
}
function sourcePermissions(selected: Bot): string {
	if (template(selected) === "writing") {
		const files = (inventories.get(selected.id) ?? [])
			.map(
				(name) =>
					`<label><input type="checkbox" data-file="${htmlText(name)}" ${selected.selectedFiles?.includes(name) ? "checked" : ""}>${htmlText(name)}</label>`,
			)
			.join("");
		return `<p>Read-only folder: ${htmlText(selected.folder ?? "None selected")}</p><button id="folder">Choose folder</button><button id="revoke-folder" class="secondary">Remove folder access</button><p class="muted">Explicit top-level .md, .adoc, .asciidoc and .txt manuscripts. No recursion or source changes.</p><p>Selected: ${htmlText(selected.selectedFiles?.join(", ") || "None")}</p><button id="list-files" class="secondary">Refresh manuscript list</button>${files}<button id="select-files" class="secondary">Save manuscript selection</button>`;
	}
	if (template(selected) === "research")
		return `<label>Explicit public page<input id="page" value="${htmlText(selected.page ?? "")}" placeholder="https://example.com/"></label><p class="muted">HTTPS only: example.com, introducing.muse.ai, docs.x.ai. No redirects.</p>`;
	return "<p>Local conversation only. No source-read capability.</p>";
}
function messagesMarkup(bot: Bot): string {
	const runs = state.runs.filter(
		(run) =>
			(run.payload as { botId?: string }).botId === bot.id &&
			displayedSession(run.payload) === contextView(bot.id).selected &&
			typeof (run.payload as { prompt?: string }).prompt === "string",
	);
	return (
		runs
			.map((run) => {
				const prompt = (run.payload as { prompt: string }).prompt;
				const outcome = run.result || STATUS_LABELS[run.status];
				return `<div class="message-row user-message"><article class="message-bubble"><strong>You</strong><div>${htmlText(prompt)}</div></article></div><div class="message-row bot-message">${avatar(bot)}<article class="message-bubble"><strong>${htmlText(bot.name)}</strong><div>${htmlText(outcome)}</div>${run.status === "succeeded" ? "" : `<button class="message-status text-button" data-work="${htmlText(run.id)}" aria-label="Inspect ${htmlText(STATUS_LABELS[run.status])} task">${htmlText(STATUS_LABELS[run.status])} · Details</button>`}</article></div>`;
			})
			.join("") ||
		`<div class="conversation-empty"><p>Start a conversation with ${htmlText(bot.name)}.</p><p class="muted">Your saved conversations are in the Bot menu.</p></div>`
	);
}
function menuMarkup(): string {
	if (!botMenu) return "";
	return `<div class="bot-menu" role="menu" aria-label="Bot actions">${Object.entries(
		panelNames,
	)
		.map(
			([key, label]) =>
				`<button id="menu-${key}" role="menuitem" data-panel="${key}">${label}</button>`,
		)
		.join(
			"",
		)}<button role="menuitem" id="menu-appearance">Appearance</button><button role="menuitem" id="menu-close">Close menu</button></div>`;
}
function botWorkspace(
	selected: Bot,
	current: Bot | undefined,
	selectedSession: string,
	selectedKey: string,
	settingsOpen: boolean,
): string {
	return `<div class="conversation">
 <div id="messages" data-scope="${htmlText(conversationKey(selected.id))}" class="messages" tabindex="0" role="log" aria-label="Conversation messages">${messagesMarkup(selected)}</div>
 <section class="composer"><label class="composer-label"><span class="visually-hidden">Message ${htmlText(current?.name ?? selected.name)}</span><textarea id="prompt" rows="2" placeholder="Message ${htmlText(current?.name ?? selected.name)}…"></textarea></label><p id="recipient-label" class="recipient-label visually-hidden">Sending to ${htmlText(current?.name ?? selected.name)} · ${htmlText(recipient(selected.id))}</p><div class="composer-actions"><button data-panel="tasks" class="text-button" aria-label="Task options">+ Task options</button><button id="run" class="text-button" aria-label="Send" aria-describedby="recipient-label">Send ↑</button></div></section>
 <div id="bot-panel" class="management-panel" role="region" aria-labelledby="panel-heading" ${panel ? "" : "hidden"}><div class="panel-heading"><h2 id="panel-heading">${htmlText(panelNames[panel] ?? "Bot tools")}</h2><button id="panel-close" class="secondary" aria-label="Close Bot tools">Close</button></div>
 <div data-panel-content="conversations" ${panel === "conversations" ? "" : "hidden"}>${conversationLinks(current ?? selected)}<div id="local-result-notifications">${notificationMarkup(selected.id)}</div><details id="input-receipts-panel" data-scope="${htmlText(selectedKey)}" ${inputReceiptsOpen(selected.id, selectedSession) ? "open" : ""}><summary>Received local inputs</summary><div id="local-input-receipts">${localInputMarkup(selected.id)}</div></details></div>
 <div data-panel-content="projects" ${panel === "projects" ? "" : "hidden"}><details class="context-tools" data-bot-id="${htmlText(selected.id)}" open><summary>Projects & notes</summary>${contextMarkup(selected.id)}</details></div>
 <div data-panel-content="tasks" ${panel === "tasks" ? "" : "hidden"}><div class="row"><select id="mode" aria-label="Task mode"><option value="chat">Local chat · no source reading</option>${sourceModeOption(selected)}</select><button id="preview">Preview task</button></div><details><summary>Recurring jobs · review before enabling</summary><div class="row"><select id="minutes" aria-label="Schedule interval"><option value="1">Every minute (trial)</option><option value="15">Every 15 minutes</option><option value="60">Every hour</option><option value="1440">Every 24 hours</option></select><button class="secondary" id="schedule" ${proposals.has(selectedKey) ? "" : "disabled"}>Schedule task</button></div></details><div id="proposal">${proposalMarkup(selectedKey)}</div><h2>Work & execution evidence</h2><div id="activity">${activity()}</div><h2>Recurring jobs</h2>${routineMarkup(selected.id)}<button data-stop-companion="${selected.id}" class="secondary">Stop this Companion</button></div>
 <div data-panel-content="settings" ${panel === "settings" ? "" : "hidden"}><details open><summary>Model & profile settings</summary><button id="profile-appearance" class="secondary">Change appearance</button><details class="model-disclosure" ${(current?.model && catalog?.ollama.status === "ready") || current?.provider === "apple" ? "" : "open"}><summary>Local model setup</summary>${modelSetup(current ?? selected)}</details><section><details id="settings" ${settingsOpen ? "open" : ""}><summary>Customize Companion · profile, memory & permissions</summary><h3>Identity</h3><label>Name<input id="name" value="${htmlText(selected.name)}"></label><label>Personality<textarea id="personality">${htmlText(selected.personality)}</textarea></label><label>Tone<input id="tone" value="${htmlText(selected.tone)}"></label><label>Role<textarea id="role">${htmlText(selected.role)}</textarea></label><h3>Memory</h3><label>Inspectable memory<textarea id="memory">${htmlText(selected.memory)}</textarea></label><h3>Allowed sources & tools</h3><p class="muted">Local model only. Read-only source access. No shell, file editing or cloud fallback. Memory proposals require approval.</p>${sourcePermissions(selected)}<button id="save">Save profile</button><button id="reload-profile" class="secondary">Reload current profile</button></details></section></details></div>
 <div data-panel-content="focus" ${panel === "focus" ? "" : "hidden"}>${template(selected) === "moku" ? focusMarkup(selected) + nurturingMarkup(selected) : "<p>No focus session for this Bot.</p>"}</div>
 </div></div>`;
}
function taskFocusCard(bot: Bot): string {
	const saved = life(bot).session;
	const session = saved
		? `<p>${htmlText(saved.step)} · ${htmlText(saved.status)}</p><p>Reported progress: ${htmlText(saved.progress || "Not reported")}</p>`
		: "<p>No focus session.</p>";
	return `<section><h2>${htmlText(bot.name)} · focus session</h2>${session}<button data-view="${bot.id}">Open ${htmlText(bot.name)}</button></section>`;
}
function otherWorkspace(): string {
	if (view === "library") return libraryMarkup();
	if (view === "plugins") return pluginsMarkup();
	if (view === "routines")
		return ownerFilter() + routineMarkup(owner === "all" ? undefined : owner);
	if (view === "tasks") {
		const focus = bots()
			.filter(
				(bot) =>
					template(bot) === "moku" && (owner === "all" || owner === bot.id),
			)
			.map(taskFocusCard)
			.join("");
		return `${ownerFilter()}${focus}<h2>Agent work & receipts</h2><div id="activity">${activity()}</div>`;
	}
	return `<div class="conversation-empty"><p>No Bots yet. Add a companion to start a conversation.</p><button data-view="library">Add a Bot</button></div>`;
}

function render(): void {
	if (!state) return;
	const activeId = (document.activeElement as HTMLElement)?.id;
	const previousMessages = document.getElementById("messages");
	const previousScroll = previousMessages?.scrollTop;
	const previousBottom =
		!previousMessages ||
		previousMessages.scrollHeight -
			previousMessages.scrollTop -
			previousMessages.clientHeight <
			48;
	const previousScope = previousMessages?.dataset.scope;
	const panelScroll = document.getElementById("bot-panel")?.scrollTop ?? 0;
	rememberWorkFilters();
	const priorReceipts = root.querySelector<HTMLDetailsElement>(
		"#input-receipts-panel",
	);
	if (priorReceipts?.dataset.scope)
		receiptPanels.set(priorReceipts.dataset.scope, priorReceipts.open);
	const priorTools = root.querySelector<HTMLDetailsElement>(".context-tools");
	if (priorTools?.dataset.botId)
		contextTools.set(priorTools.dataset.botId, priorTools.open);
	const settingsOpen =
		(document.getElementById("settings") as HTMLDetailsElement | null)?.open ??
		false;
	if (
		!bots().some((bot) => bot.id === view) &&
		!["home", "library", "tasks", "routines", "plugins", "settings"].includes(
			view,
		)
	)
		view = "home";
	if (view === "home" && bots().length)
		view = bots().find((bot) => template(bot) === "moku")?.id ?? bots()[0].id;
	const current = bots().find((b) => b.id === view);
	const selectedSession = current ? contextView(current.id).selected : "";
	const selectedKey = current
		? conversationKey(current.id, selectedSession)
		: "";
	const selected = current
		? { ...current, ...drafts.get(current.id) }
		: undefined;

	const pageTitle =
		current?.name ??
		{
			home: "Welcome home",
			library: "Bot Library",
			tasks: "Tasks",
			routines: "Recurring jobs",
			plugins: "Plugins",
			settings: "App settings",
		}[view] ??
		"Welcome home";
	const subtitle = selected
		? {
				moku: "Quiet focus companion · One small step at a time",
				writing: "Selected-manuscript reader · Read only",
				research: "Selected-page reader · Read only",
				custom: "Your personal conversation companion",
			}[template(selected)]
		: "A little company, one small step.";

	const recipientAvatar = selected
		? `<button class="recipient-avatar" id="header-appearance" aria-label="Change ${htmlText(current?.name ?? selected.name)} appearance">${avatar(selected)}</button>`
		: "";

	const alerts =
		alertMarkup(error) +
		alertMarkup(
			state.data.messageError,
			"Local input recovery needs inspection: ",
			". New execution is paused.",
		) +
		alertMarkup(
			state.data.approvalError,
			"Approval answer recovery needs inspection: ",
			". New execution is paused.",
		) +
		alertMarkup(
			state.data.notificationError,
			"Local result notification delivery needs attention: ",
			". Saved execution results are retained; notification retries do not execute work.",
		) +
		alertMarkup(
			state.data.contextRecoveryError,
			"Project result recovery is blocked: ",
			". New execution is paused; no result or operation is replayed. Session ownership evidence requires offline inspection with Nest stopped.",
		);
	const appearanceDialog =
		appearance && selected
			? appearanceMarkup(
					current ?? selected,
					appearance.color,
					pending.has(`appearance:${appearance.botId}`),
					error,
				)
			: "";
	root.innerHTML = `<div class="app-shell ${selected ? "character-workspace" : ""}">${characterRail(bots(), view, color, unseen)}<main><header class="page-header">${recipientAvatar}<div><h1>${htmlText(pageTitle)}</h1>${selected ? `<button class="conversation-picker text-button" data-panel="conversations" aria-label="Choose conversation">${htmlText(recipient(selected.id))}</button>` : `<p>${htmlText(subtitle)}</p>`}</div></header>${alerts}${selected ? botWorkspace(selected, current, selectedSession, selectedKey, settingsOpen) : view === "settings" ? `<h2>App settings</h2><div class="local"><strong>Execution: Local</strong><p>${htmlText(health)}</p><button id="health" class="secondary">Check local models</button></div><nav aria-label="App settings"><button data-view="plugins">Plugins</button><button data-view="tasks">Tasks</button><button data-view="routines">Recurring jobs</button></nav>` : otherWorkspace()}</main>${menuMarkup()}${appearanceDialog}</div>`;
	const closeTools = () => {
		botMenu = undefined;
		panel = "";
		editing = false;
		render();
		document.getElementById(returnFocus)?.focus();
	};
	for (const trigger of root.querySelectorAll<HTMLButtonElement>(
		"[data-bot-menu]",
	)) {
		const open = () => {
			const id = trigger.dataset.botMenu ?? "";
			const closing = botMenu === id;
			if (view !== id) navigate(id);
			returnFocus = trigger.id;
			botMenu = closing ? undefined : id;
			panel = "";
			editing = Boolean(botMenu);
			render();
			if (closing) document.getElementById(returnFocus)?.focus();
			else root.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
		};
		trigger.setAttribute(
			"aria-expanded",
			String(botMenu === trigger.dataset.botMenu),
		);
		trigger.onclick = open;
		trigger.onkeydown = (event) => {
			if (
				(event.shiftKey && event.key === "F10") ||
				event.key === "ContextMenu"
			) {
				event.preventDefault();
				open();
			}
		};
		const row = trigger.closest<HTMLElement>(".bot-row");
		if (row)
			row.oncontextmenu = (event) => {
				event.preventDefault();
				open();
			};
	}
	for (const trigger of root.querySelectorAll<HTMLButtonElement>(
		"[data-panel]",
	))
		trigger.onclick = () => {
			returnFocus = botMenu
				? `bot-menu-${view}`
				: trigger.id || `bot-menu-${view}`;
			panel =
				panel === trigger.dataset.panel ? "" : (trigger.dataset.panel ?? "");
			botMenu = undefined;
			editing = Boolean(panel);
			render();
			document.getElementById("panel-close")?.focus();
		};
	const closeButton = document.getElementById("panel-close");
	if (closeButton) closeButton.onclick = closeTools;
	const menuClose = document.getElementById("menu-close");
	if (menuClose) menuClose.onclick = closeTools;
	document.onkeydown = (event) => {
		if (appearance) return;
		if (event.key === "Escape" && (panel || botMenu)) {
			event.preventDefault();
			closeTools();
		}
		if (
			botMenu &&
			["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
		) {
			event.preventDefault();
			const items = [
				...root.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
			];
			const index = items.indexOf(document.activeElement as HTMLButtonElement);
			const next =
				event.key === "Home"
					? 0
					: event.key === "End"
						? items.length - 1
						: (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
							items.length;
			items[next]?.focus();
		}
	};
	document.onclick = (event) => {
		if (
			botMenu &&
			!(event.target as HTMLElement).closest(".bot-menu,[data-bot-menu]")
		)
			closeTools();
	};
	for (const button of root.querySelectorAll<HTMLButtonElement>("[data-work]"))
		button.onclick = () => {
			panel = "tasks";
			editing = true;
			render();
			document.getElementById(`run-${button.dataset.work}`)?.focus();
		};

	for (const b of root.querySelectorAll<HTMLButtonElement>("[data-view]")) {
		b.onclick = () => {
			navigate(b.dataset.view ?? "home");
		};
	}
	for (const b of root.querySelectorAll<HTMLButtonElement>("[data-add]"))
		b.onclick = () => {
			const template = b.dataset.add ?? "custom";
			const requestId = addRequests.get(template) ?? crypto.randomUUID();
			addRequests.set(template, requestId);
			b.disabled = true;
			void call("add-bot", { template, requestId }).then(() => {
				if (!error) addRequests.delete(template);
			});
		};
	const ownerSelect = document.getElementById(
		"owner-filter",
	) as HTMLSelectElement | null;
	if (ownerSelect)
		ownerSelect.onchange = () => {
			owner = ownerSelect.value;
			editing = false;
			render();
		};
	if (selected && template(selected) === "moku") {
		const saved = focusDrafts.get(selected.id);
		if (saved)
			for (const [id, text] of [
				["focus-step", saved.step],
				["progress", saved.progress],
				["next-step", saved.nextStep],
			]) {
				const e = document.getElementById(id) as HTMLInputElement | null;
				if (e) e.value = text;
			}
		for (const e of root.querySelectorAll<HTMLInputElement>(
			"#focus-step,#progress,#next-step",
		))
			e.oninput = () => {
				focusDrafts.set(selected.id, {
					step:
						(document.getElementById("focus-step") as HTMLInputElement)
							?.value ?? "",
					progress:
						(document.getElementById("progress") as HTMLInputElement)?.value ??
						"",
					nextStep:
						(document.getElementById("next-step") as HTMLInputElement)?.value ??
						"",
				});
			};
		const mutate = (extra: object) => {
			editing = false;
			void call("focus", {
				id: selected.id,
				revision: life(selected).revision,
				eventId: crypto.randomUUID(),
				...extra,
			});
		};
		for (const b of root.querySelectorAll<HTMLButtonElement>("[data-focus]"))
			b.onclick = () => {
				b.disabled = true;
				mutate({
					action: b.dataset.focus,
					step:
						(document.getElementById("focus-step") as HTMLInputElement)
							?.value ?? "",
					progress:
						(document.getElementById("progress") as HTMLInputElement)?.value ??
						"",
					nextStep:
						(document.getElementById("next-step") as HTMLInputElement)?.value ??
						"",
				});
			};
		const n = document.getElementById("nurturing") as HTMLInputElement;
		n.onchange = () => mutate({ action: "nurturing", enabled: n.checked });
		for (const b of root.querySelectorAll<HTMLButtonElement>(
			"[data-decoration]",
		))
			b.onclick = () =>
				mutate({
					action: "decoration",
					item: b.dataset.decoration,
					placed: b.dataset.placed === "true",
				});
	}

	bindWorkActions();
	const value = (id: string): string =>
		(document.getElementById(id) as HTMLInputElement)?.value ?? "";
	const button = (id: string, action: () => void): void => {
		const b = document.getElementById(id);
		if (b) b.onclick = action;
	};
	button("health", () => void checkModels());
	if (selected) {
		const tools = root.querySelector<HTMLDetailsElement>(".context-tools");
		if (tools)
			tools.ontoggle = () => {
				if (tools.isConnected) contextTools.set(selected.id, tools.open);
			};
		bindLocalInputRetry(selected.id);
		const contextSelect = document.getElementById(
			"context-session",
		) as HTMLSelectElement;
		contextSelect.onchange = () =>
			selectConversation(selected.id, contextSelect.value);
		for (const link of root.querySelectorAll<HTMLButtonElement>(
			"[data-session]",
		))
			link.onclick = () =>
				selectConversation(selected.id, link.dataset.session ?? "");
		const openAppearance = () => {
			botMenu = undefined;
			appearance = { botId: selected.id, color: color(selected.id) };
			editing = true;
			render();
		};
		for (const id of [
			"appearance-open",
			"profile-appearance",
			"header-appearance",
			"menu-appearance",
		])
			button(id, openAppearance);
		const dialog = root.querySelector<HTMLDialogElement>("#appearance-dialog");
		if (dialog) {
			dialog.showModal();
			dialog
				.querySelector<HTMLButtonElement>('[data-color][aria-pressed="true"]')
				?.focus();
			const closeAppearance = () => {
				if (pending.has(`appearance:${selected.id}`)) return;
				appearance = undefined;
				editing = false;
				render();
				(
					document.getElementById(
						"header-appearance",
					) as HTMLButtonElement | null
				)?.focus();
			};
			dialog.oncancel = (event) => {
				event.preventDefault();
				closeAppearance();
			};
			button("appearance-cancel", closeAppearance);
			for (const choice of dialog.querySelectorAll<HTMLButtonElement>(
				"[data-color]",
			))
				choice.onclick = () => {
					if (!appearance || pending.has(`appearance:${selected.id}`)) return;
					appearance.color = choice.dataset.color as CharacterColor;
					render();
				};
			button("appearance-apply", () => {
				const chosen = appearance;
				if (!chosen || pending.has(`appearance:${chosen.botId}`)) return;
				void call("appearance", { id: chosen.botId, color: chosen.color }).then(
					() => {
						if (!error && appearance === chosen) appearance = undefined;
						editing = Boolean(appearance);
						render();
					},
				);
				render();
			});
		}
		button("notes-open", () => {
			const tools = root.querySelector<HTMLDetailsElement>(".context-tools");
			if (tools) tools.open = true;
			contextTools.set(selected.id, true);
			const notes = root.querySelector<HTMLDetailsElement>(
				"#project-notes-panel",
			);
			if (notes) notes.open = true;
			tools?.scrollIntoView({ block: "start" });
			(tools?.querySelector("summary") as HTMLElement | null)?.focus();
		});
		if (pending.has(`context-select:${selected.id}`)) {
			for (const id of ["run", "preview", "schedule", "context-session"])
				(document.getElementById(id) as HTMLButtonElement).disabled = true;
		}

		const contextCommand = (command: string, extra: object) => {
			editing = false;
			const key = JSON.stringify([selected.id, command, extra]);
			const operationId = contextOperations.get(key) ?? crypto.randomUUID();
			contextOperations.set(key, operationId);
			void call(command, { id: selected.id, operationId, ...extra });
		};
		button("project-create", () =>
			contextCommand("project-create", { name: value("project-name") }),
		);
		button("session-create", () =>
			contextCommand("session-create", {
				projectId: value("conversation-project"),
				name: value("conversation-name"),
			}),
		);
		bindProjectNotes(root, contextView(selected.id), {
			send: (command, input) => window.nest.call(command, input),
			reload: refresh,
			repaint: () => {
				editing = false;
				render();
			},
			current: () => contextView(selected.id),
		});

		button("check-models", () => void checkModels());
		const providerElement = document.getElementById(
			"provider",
		) as HTMLSelectElement;
		const modelElement = document.getElementById("model") as HTMLSelectElement;
		providerElement.onchange = () => {
			const provider = providerElement.value;
			const model =
				provider === "apple"
					? "system"
					: selected.provider === "ollama"
						? selected.model
						: "";
			modelDrafts.set(selected.id, { provider, model });
			modelElement.innerHTML = modelOptions(provider, model);
			editing = true;
		};
		modelElement.onchange = () => {
			modelDrafts.set(selected.id, {
				provider: providerElement.value,
				model: modelElement.value,
			});
			editing = true;
		};
		button(
			"select-model",
			() =>
				void call("select-model", {
					id: selected.id,
					provider: providerElement.value,
					model: modelElement.value,
					profileRevision: current?.profileRevision ?? 0,
				}),
		);
		const draft = tasks.get(selectedKey);
		if (draft)
			for (const key of ["prompt", "mode", "minutes"] as const)
				(document.getElementById(key) as HTMLInputElement).value = draft[key];
		button("preview", () => {
			const prompt = value("prompt"),
				mode = value("mode");
			editing = true;
			void window.nest
				.call("preview", { id: selected.id, prompt, mode })
				.then((result) => {
					proposals.set(selectedKey, {
						preview: result as WorkflowPreview,
						requestId: crypto.randomUUID(),
					});
					error = "";
					render();
				})
				.catch((e) => {
					error = String(e);
					proposals.delete(selectedKey);
					render();
				});
		});
		button("reload-profile", () => {
			if (
				drafts.has(selected.id) &&
				!confirm(
					"Discard this Companion's unsaved profile edits and reload its current profile?",
				)
			)
				return;
			drafts.delete(selected.id);
			revisions.delete(selected.id);
			editing = false;
			render();
		});
		button("list-files", () => {
			void window.nest
				.call("manuscript-files", { id: selected.id })
				.then((names) => {
					inventories.set(selected.id, names as string[]);
					render();
				})
				.catch((e) => {
					error = String(e);
					render();
				});
		});
		button(
			"select-files",
			() =>
				void call("select-files", {
					id: selected.id,
					files: [
						...root.querySelectorAll<HTMLInputElement>("[data-file]:checked"),
					].map((e) => e.dataset.file),
				}),
		);
		button("folder", () => void call("folder", { id: selected.id }));
		button(
			"revoke-folder",
			() => void call("revoke-folder", { id: selected.id }),
		);
		button("save", () => {
			editing = false;
			void call("save", {
				id: selected.id,
				profileRevision:
					revisions.get(selected.id) ?? current?.profileRevision ?? 0,
				personality: value("personality"),
				tone: value("tone"),
				name: value("name"),
				role: value("role"),
				memory: value("memory"),
				page: value("page"),
			});
		});
		button("run", () => {
			const prompt = value("prompt"),
				mode = value("mode");
			(document.getElementById("run") as HTMLButtonElement).disabled = true;
			editing = false;
			if (mode === "chat") {
				try {
					const input = prepareInput(localStorage, {
						id: selected.id,
						prompt,
						requestId: crypto.randomUUID(),
						sessionId: selectedSession,
						...(proposals.get(selectedKey)
							? { previewToken: proposals.get(selectedKey)?.preview.token }
							: {}),
					});
					void call("chat", input);
				} catch (e) {
					error = e instanceof Error ? e.message : String(e);
					render();
				}
			} else {
				const proposal = proposals.get(selectedKey);
				if (!proposal) {
					error = "Preview the selected-source task before sending.";
					render();
					return;
				}
				void call("run", {
					id: selected.id,
					prompt,
					mode,
					requestId: proposal.requestId,
					previewToken: proposal.preview.token,
				});
			}
		});
		button("schedule", () => {
			const proposal = proposals.get(selectedKey);
			if (!proposal) return;
			const prompt = value("prompt");
			(document.getElementById("run") as HTMLButtonElement).disabled = true;
			(document.getElementById("schedule") as HTMLButtonElement).disabled =
				true;
			editing = false;
			void call("schedule", {
				id: selected.id,
				prompt,
				mode: value("mode"),
				minutes: Number(value("minutes")),
				previewToken: proposal.preview.token,
			});
		});
	}
	root.querySelectorAll("input,textarea,select").forEach(
		(e) =>
			void e.addEventListener("input", () => {
				editing = true;
				if (
					selected &&
					["prompt", "mode", "minutes"].includes((e as HTMLElement).id)
				) {
					tasks.set(selectedKey, {
						prompt: value("prompt"),
						mode: value("mode"),
						minutes: value("minutes"),
					});
					if ((e as HTMLElement).id !== "minutes") {
						proposals.delete(selectedKey);
						const preview = document.getElementById("proposal");
						if (preview) preview.innerHTML = proposalMarkup(selectedKey);
						(document.getElementById("run") as HTMLButtonElement).disabled =
							value("mode") !== "chat";
						(
							document.getElementById("schedule") as HTMLButtonElement
						).disabled = true;
					}
				}
				if (
					selected &&
					["name", "personality", "tone", "role", "memory", "page"].includes(
						(e as HTMLElement).id,
					)
				) {
					if (!revisions.has(selected.id))
						revisions.set(selected.id, current?.profileRevision ?? 0);
					drafts.set(
						selected.id,
						Object.fromEntries(
							["name", "personality", "tone", "role", "memory", "page"].map(
								(id) => [id, value(id)],
							),
						),
					);
				}
			}),
	);
	if (!appearance && activeId)
		document.getElementById(activeId)?.focus({ preventScroll: true });
	const messages = document.getElementById("messages");
	if (messages)
		messages.scrollTop =
			previousScope === messages.dataset.scope &&
			previousScroll !== undefined &&
			!previousBottom
				? previousScroll
				: messages.scrollHeight;
	const toolsPanel = document.getElementById("bot-panel");
	if (toolsPanel) toolsPanel.scrollTop = panelScroll;
	const sendButton = document.getElementById("run") as HTMLButtonElement | null;
	if (sendButton) {
		sendButton.textContent =
			value("mode") === "chat" ? "Send ↑" : "Send task ↑";
		sendButton.disabled =
			(value("mode") !== "chat" && !proposals.has(selectedKey)) ||
			pending.has(`context-select:${selected?.id}`);
	}
	const prompt = document.getElementById(
		"prompt",
	) as HTMLTextAreaElement | null;
	if (prompt)
		prompt.onkeydown = (event) => {
			if (
				event.key === "Enter" &&
				(event.metaKey || event.ctrlKey) &&
				!event.isComposing
			) {
				event.preventDefault();
				document.getElementById("run")?.click();
			}
		};
}
let refreshSequence = 0;
let appliedRefresh = 0;
async function refresh(): Promise<void> {
	const sequence = ++refreshSequence;
	const next = (await window.nest.call("state")) as WorkState;
	if (sequence < appliedRefresh) return;
	appliedRefresh = sequence;
	const priorSession = state ? contextView(view).selected : undefined;
	const nextSession = (
		next.data.contextViews as Record<string, ContextView> | undefined
	)?.[view]?.selected;
	const contextChanged = priorSession !== nextSession;
	const changed = !state || JSON.stringify(next) !== JSON.stringify(state);
	state = next;
	if (changed) {
		if (contextChanged || (!editing && !appearance)) render();
		else renderActivity();
	}
}
void (async () => {
	await refresh();
	await checkModels();
	setInterval(() => {
		void refresh();
		const bot = bots().find((b) => b.id === view),
			target = document.querySelector("[data-timer]");
		const session =
			bot && template(bot) === "moku" ? life(bot).session : undefined;
		if (session && target) {
			const time = remaining(session);
			const status = document.querySelector("[data-focus-status]");
			if (status)
				status.textContent =
					session.status === "paused"
						? "Paused"
						: time === 0
							? "Time elapsed · progress unverified"
							: "Quiet focus";
			target.textContent = `${Math.floor(time / 60000)}:${String(Math.floor(time / 1000) % 60).padStart(2, "0")}`;
		}
	}, 1000);
})();
let narrowLayout = innerWidth <= 700;
addEventListener("resize", () => {
	const next = innerWidth <= 700;
	if (next !== narrowLayout) {
		narrowLayout = next;
		render();
	}
});
