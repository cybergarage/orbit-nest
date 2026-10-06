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
				WorkState | string | string[] | WorkflowPreview | ModelCatalog
			>;
		};
	}
}
let state: WorkState;
let view = "home";
let editing = false;
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
const chatRequests = new Map<string, string>();
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
	if (pending.has(key)) return;
	pending.add(key);
	try {
		await window.nest.call(command, input);
		if (
			command === "focus" &&
			["start", "close"].includes(String((input as { action?: string }).action))
		)
			focusDrafts.delete((input as { id: string }).id);
		if (command === "chat") chatRequests.delete((input as { id: string }).id);
		if (command === "run" || command === "schedule")
			proposals.delete((input as { id: string }).id);
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
			proposals.delete((input as { id: string }).id);
		}
		if (command === "save") {
			const id = (input as { id: string }).id;
			drafts.delete(id);
			revisions.delete(id);
		}
		error = "";
		await refresh();
		if (!editing) render();
	} catch (e) {
		error = e instanceof Error ? e.message : String(e);
		if (
			(command === "run" || command === "schedule") &&
			error.includes("changed")
		)
			proposals.delete((input as { id: string }).id);
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
function avatar(bot: Bot, large = false): string {
	const t = template(bot),
		file =
			t === "moku"
				? "moku.png"
				: t === "writing"
					? "owl.svg"
					: t === "research"
						? "fox.svg"
						: "";
	return file
		? `<img class="portrait ${large ? "large" : ""}" src="assets/${file}" alt="${t === "moku" ? "Moku, temporary woodland companion" : t === "writing" ? "Original owl companion illustration" : "Original fox companion illustration"}">`
		: `<span class="bot-mark ${large ? "large" : ""}" aria-hidden="true">🌱</span>`;
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
function card(run: ScheduledRun): string {
	const p = run.payload as { botId?: string; prompt?: string; kind?: string };
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
 ${run.approval && run.status === "approval" ? `<p>Approval required before local memory replacement. Exact planned change:</p><pre>${htmlText(run.approval.preview)}</pre><button data-approve="${htmlText(run.id)}">Approve memory replacement</button><button class="secondary" data-deny="${htmlText(run.id)}">Reject</button>` : ""}
 ${run.result ? `<details class="receipt" ${receipt ? "open" : ""}><summary>${receipt ? "Saved result receipt" : "Saved execution outcome"}</summary><pre>${htmlText(run.result)}</pre></details>` : run.status === "succeeded" ? "<p>No result text is attached to this completed record. Inspect execution evidence below.</p>" : ""}
 ${receipt && p.prompt ? `<button class="secondary" data-remember="${htmlText(run.id)}">Review saving to memory</button>` : ""}
 ${["queued", "running", "approval"].includes(run.status) ? `<button class="secondary" data-cancel="${htmlText(run.id)}">${run.status === "running" ? "Request stop" : "Cancel"}</button><p class="muted">${run.effect === "read" ? "Stopping is cooperative; a local model may continue computing briefly. Cancelled output cannot be saved as a completed result." : "An interrupted operation with an uncertain effect is marked unknown; stopping does not prove it was undone."}</p>` : ""}
 ${run.status === "unknown" ? `<p>Outcome unresolved. Automatic replay is blocked. Inspect this record before confirming the operation stopped; this does not undo an effect.</p><button class="secondary" data-reconcile="${htmlText(run.id)}">Confirm stopped and close unresolved work</button>` : ""}
 <details><summary>Execution evidence</summary><small>Run ${htmlText(run.id)}<br>Occurrence ${htmlText(run.occurrenceId)}<br>Request ${htmlText(run.requestId)}<br>Persisted status: ${run.status}<br>${
		state.attempts
			.filter((a) => a.runId === run.id)
			.map((a) => `${htmlText(a.id)} · ${htmlText(a.status)}`)
			.join("<br>") || "No attempt has started."
 }</small></details></article>`;
}
function activity(): string {
	const runs = state.runs
		.filter((r) =>
			bots().some((b) => b.id === view)
				? (r.payload as { botId?: string }).botId === view
				: owner === "all" || (r.payload as { botId?: string }).botId === owner,
		)
		.slice()
		.reverse();
	const filters = ["all", ...Object.keys(STATUS_LABELS)];
	return `<div class="filters" role="group" aria-label="Task states">${filters.map((key) => `<button class="secondary" data-filter="${key}" aria-pressed="${filter === key}">${key === "all" ? "All work" : STATUS_LABELS[key as keyof typeof STATUS_LABELS]} (${runs.filter((r) => key === "all" || r.status === key).length})</button>`).join("")}</div><p class="muted">Statuses come from persisted Orbit work records. Completion wording in chat is not proof of execution.</p>${
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
			const current = companionActivity(state, bot.id),
				session = template(bot) === "moku" ? life(bot).session : undefined;
			const jobs = state.schedules.filter(
				(s) => (s.payload as { botId?: string }).botId === bot.id,
			);
			const next = jobs
				.filter((s) => !s.paused)
				.sort((a, b) => a.next - b.next)[0];
			return `<article class="companion-card">${avatar(bot, true)}<h2>${htmlText(bot.name)}</h2><p>${template(bot) === "moku" ? "Quiet focus companion" : template(bot) === "writing" ? "Selected-manuscript reader" : template(bot) === "research" ? "Selected-page reader" : "Your personal conversation companion"}</p><h3>Current work</h3>${session ? `<p><span class="badge">Focus · ${session.status}</span> ${htmlText(session.step)}</p><p class="muted">Reported by you: ${htmlText(session.progress || "No progress reported")}</p>` : ""}${current.active.map((r) => `<p><span class="badge ${r.status}">${STATUS_LABELS[r.status]}</span> ${htmlText((r.payload as { prompt?: string }).prompt ?? "Memory replacement")}</p>`).join("")}${!session && !current.active.length ? '<p class="muted">Ready when you are.</p>' : ""}${current.unresolved.length ? `<p class="badge unknown">${current.unresolved.length} unresolved interrupted operation(s)</p>` : ""}<h3>Next recurring job</h3><p>${next ? new Date(next.next).toLocaleString() : "None enabled"} · ${jobs.filter((s) => s.paused).length} paused</p>${current.recentResult ? `<details><summary>Recent saved result</summary><p>${htmlText(current.recentResult.result?.slice(0, 220))}</p></details><button class="secondary" data-receipt="${current.recentResult.id}">Open saved result</button>` : ""}<div class="actions"><button data-view="${bot.id}">Open Companion</button><button class="secondary" data-stop-companion="${bot.id}">Stop this Companion</button></div></article>`;
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
	for (const b of root.querySelectorAll<HTMLButtonElement>("[data-receipt]"))
		b.onclick = () => {
			filter = "all";
			renderActivity();
			const run = document.getElementById(`run-${b.dataset.receipt}`);
			run?.scrollIntoView({ block: "start" });
			run?.focus();
		};
}
function renderActivity(): void {
	const focused = (document.activeElement as HTMLElement)?.getAttribute(
		"data-filter",
	);
	const target = document.getElementById("activity");
	if (target) target.innerHTML = activity();
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
function render(): void {
	if (!state) return;
	const settingsOpen =
		(document.getElementById("settings") as HTMLDetailsElement | null)?.open ??
		false;
	const current = bots().find((b) => b.id === view);
	const selected = current
		? { ...current, ...drafts.get(current.id) }
		: undefined;

	const pageTitle =
		selected?.name ??
		{
			home: "Welcome home",
			library: "Bot Library",
			tasks: "Tasks",
			routines: "Recurring jobs",
			plugins: "Plugins",
		}[view] ??
		"Welcome home";
	root.innerHTML = `<div class="app-shell"><aside class="navigation"><div class="brand">🌱 Orbit Nest</div><details class="nav-disclosure" ${innerWidth > 700 ? "open" : ""}><summary>Navigation</summary><nav aria-label="Main navigation">${[
		["home", "⌂", "Home"],
		["library", "♧", "Bots"],
		["tasks", "☷", "Tasks"],
		["routines", "↻", "Recurring jobs"],
		["plugins", "♧", "Plugins"],
	]
		.map(
			([id, icon, label]) =>
				`<button data-view="${id}" class="nav ${view === id || (id === "library" && selected) ? "selected" : ""}" ${view === id || (id === "library" && selected) ? 'aria-current="page"' : ""}><span aria-hidden="true">${icon}</span> ${label}</button>`,
		)
		.join("")}</nav><h4>Your companions</h4>${bots()
		.map(
			(b) =>
				`<button class="nav" data-view="${b.id}">${template(b) === "research" ? "◈" : template(b) === "writing" ? "▤" : "🌱"} ${htmlText(b.name)}</button>`,
		)
		.join(
			"",
		)}</details><div class="local"><strong>Execution: Local</strong><p>${htmlText(health)}</p><button id="health" class="secondary">Check local models</button></div></aside><main><header class="page-header">${selected ? avatar(selected, true) : ""}<div><p class="eyebrow">YOUR LOCAL WORKSPACE</p><h1>${htmlText(pageTitle)}</h1><p class="muted">${selected ? htmlText(template(selected) === "moku" ? "Quiet focus companion · One small step at a time" : template(selected) === "writing" ? "Selected-manuscript reader · Read only" : template(selected) === "research" ? "Selected-page reader · Read only" : "Your personal conversation companion") : "A little company, one small step."}</p></div></header>${error ? `<p role="alert" class="error">${htmlText(error)}</p>` : ""}${
		selected
			? `<div class="bot-layout"><div class="conversation"><section><label>What would you like help with?<textarea id="prompt" placeholder="I want to work on my manuscript."></textarea></label><div class="row"><select id="mode" aria-label="Task mode"><option value="chat">Local chat · no source reading</option>${["writing", "research"].includes(template(selected)) ? `<option value="${template(selected) === "writing" ? "writing-review" : "summary"}">${template(selected) === "writing" ? "Review selected manuscripts" : "Check selected public page"}</option>` : ""}</select><button id="preview">Preview task</button><button id="run">Send</button></div><details><summary>Recurring jobs · review before enabling</summary><div class="row"><select id="minutes" aria-label="Schedule interval"><option value="1">Every minute (trial)</option><option value="15">Every 15 minutes</option><option value="60">Every hour</option><option value="1440">Every 24 hours</option></select><button class="secondary" id="schedule" ${proposals.has(selected.id) ? "" : "disabled"}>Schedule task</button></div></details><div id="proposal">${proposalMarkup(selected.id)}</div></section>${template(selected) === "moku" ? focusMarkup(selected) : ""}<h2>Conversation & history</h2><div id="activity">${activity()}</div><details open><summary>Model & profile settings</summary><details class="model-disclosure" ${(current?.model && catalog?.ollama.status === "ready") || current?.provider === "apple" ? "" : "open"}><summary>Local model setup</summary>${modelSetup(current ?? selected)}</details><section><details id="settings" ${settingsOpen ? "open" : ""}><summary>Customize Companion · profile, memory & permissions</summary><h3>Identity</h3><label>Name<input id="name" value="${htmlText(selected.name)}"></label><label>Personality<textarea id="personality">${htmlText(selected.personality)}</textarea></label><label>Tone<input id="tone" value="${htmlText(selected.tone)}"></label><label>Role<textarea id="role">${htmlText(selected.role)}</textarea></label><h3>Memory</h3><label>Inspectable memory<textarea id="memory">${htmlText(selected.memory)}</textarea></label><h3>Allowed sources & tools</h3><p class="muted">Local model only. Read-only source access. No shell, file editing or cloud fallback. Memory proposals require approval.</p>${template(selected) === "writing" ? `<p>Read-only folder: ${htmlText(selected.folder ?? "None selected")}</p><button id="folder">Choose folder</button><button id="revoke-folder" class="secondary">Remove folder access</button><p class="muted">Explicit top-level .md, .adoc, .asciidoc and .txt manuscripts. No recursion or source changes.</p><p>Selected: ${htmlText(selected.selectedFiles?.join(", ") || "None")}</p><button id="list-files" class="secondary">Refresh manuscript list</button>${(inventories.get(selected.id) ?? []).map((name) => `<label><input type="checkbox" data-file="${htmlText(name)}" ${selected.selectedFiles?.includes(name) ? "checked" : ""}>${htmlText(name)}</label>`).join("")}<button id="select-files" class="secondary">Save manuscript selection</button>` : template(selected) === "research" ? `<label>Explicit public page<input id="page" value="${htmlText(selected.page ?? "")}" placeholder="https://example.com/"></label><p class="muted">HTTPS only: example.com, introducing.muse.ai, docs.x.ai. No redirects.</p>` : "<p>Local conversation only. No source-read capability.</p>"}<button id="save">Save profile</button><button id="reload-profile" class="secondary">Reload current profile</button></details></section></details></div><aside class="work-sidebar"><section><h2>${htmlText(selected.name)}'s work</h2>${
					companionActivity(state, selected.id)
						.active.map(
							(r) =>
								`<p><span class="badge ${r.status}">${STATUS_LABELS[r.status]}</span> ${htmlText((r.payload as { prompt?: string }).prompt ?? "Memory replacement")}</p>`,
						)
						.join("") || "<p>No active model task.</p>"
				}<button data-view="tasks" class="secondary">All tasks</button><button data-stop-companion="${selected.id}" class="secondary">Stop this Companion</button></section><section><h2>Recurring jobs</h2>${routineMarkup(selected.id)}<button data-view="routines" class="secondary">All recurring jobs</button></section>${template(selected) === "moku" ? nurturingMarkup(selected) : ""}</aside></div>`
			: view === "library"
				? libraryMarkup()
				: view === "plugins"
					? pluginsMarkup()
					: view === "routines"
						? `${ownerFilter()}${routineMarkup(owner === "all" ? undefined : owner)}`
						: view === "tasks"
							? `${ownerFilter()}${bots()
									.filter(
										(b) =>
											template(b) === "moku" &&
											(owner === "all" || owner === b.id),
									)
									.map(
										(b) =>
											`<section><h2>${htmlText(b.name)} · focus session</h2>${life(b).session ? `<p>${htmlText(life(b).session?.step)} · ${htmlText(life(b).session?.status)}</p><p>Reported progress: ${htmlText(life(b).session?.progress || "Not reported")}</p>` : "<p>No focus session.</p>"}<button data-view="${b.id}">Open ${htmlText(b.name)}</button></section>`,
									)
									.join(
										"",
									)}<h2>Agent work & receipts</h2><div id="activity">${activity()}</div>`
							: `<button data-view="library">Add a Bot</button>${companionCards()}<h2>Activity, results & approvals</h2><div id="activity">${activity()}</div>`
	}</main></div>`;

	for (const b of root.querySelectorAll<HTMLButtonElement>("[data-view]")) {
		b.onclick = () => {
			view = b.dataset.view ?? "home";
			editing = false;
			render();
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
		const draft = tasks.get(selected.id);
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
					proposals.set(selected.id, {
						preview: result as WorkflowPreview,
						requestId: crypto.randomUUID(),
					});
					error = "";
					render();
				})
				.catch((e) => {
					error = String(e);
					proposals.delete(selected.id);
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
			if (mode === "chat" && !proposals.has(selected.id)) {
				const requestId = chatRequests.get(selected.id) ?? crypto.randomUUID();
				chatRequests.set(selected.id, requestId);
				void call("chat", { id: selected.id, prompt, requestId });
			} else {
				const proposal = proposals.get(selected.id);
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
			const proposal = proposals.get(selected.id);
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
					tasks.set(selected.id, {
						prompt: value("prompt"),
						mode: value("mode"),
						minutes: value("minutes"),
					});
					if ((e as HTMLElement).id !== "minutes") {
						proposals.delete(selected.id);
						const preview = document.getElementById("proposal");
						if (preview) preview.innerHTML = proposalMarkup(selected.id);
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
}
async function refresh(): Promise<void> {
	const next = (await window.nest.call("state")) as WorkState;
	const changed = !state || JSON.stringify(next) !== JSON.stringify(state);
	state = next;
	if (changed) {
		if (!editing) render();
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
