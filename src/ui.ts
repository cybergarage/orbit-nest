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
		.filter(
			(r) =>
				view === "home" || (r.payload as { botId?: string }).botId === view,
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
	return `<div class="companion-grid">${bots()
		.map((bot) => {
			const current = companionActivity(state, bot.id);
			return `<article class="companion-card"><h2>${htmlText(bot.name)}</h2><p class="eyebrow">SAVED ROLE</p><p>${htmlText(bot.role)}</p><p>Selected execution: Local · ${htmlText(bot.provider ?? "ollama")} / ${htmlText(bot.model)}${bot.provider === "apple" ? " · text chat only" : ""}</p><p class="scope">Current selected scope: ${htmlText(bot.id === "documents" ? `${bot.folder || "No folder"} · ${bot.selectedFiles?.join(", ") || "No manuscripts selected"}` : bot.page || "No public page")}</p><h3>Current work</h3>${proposals.has(bot.id) ? `<p><span class="badge">Proposal · not submitted</span> ${htmlText(proposals.get(bot.id)?.preview.prompt)}</p>` : ""}${current.active.length ? current.active.map((r) => `<p><span class="badge ${r.status}">${STATUS_LABELS[r.status]}</span> ${htmlText((r.payload as { prompt?: string }).prompt ?? "Memory replacement")}</p>`).join("") : '<p class="muted">No queued, running or approval-required work.</p>'}${current.unresolved.length ? `<p class="badge unknown">${current.unresolved.length} unresolved interrupted operation(s) · inspect the activity log</p>` : ""}<h3>Recent saved result</h3>${current.recentResult ? `<p>${htmlText(current.recentResult.result?.slice(0, 220))}</p><button class="secondary" data-receipt="${htmlText(current.recentResult.id)}">Open saved result</button>` : '<p class="muted">No completed result yet.</p>'}<button data-view="${bot.id}">Open Companion</button><button class="secondary" data-stop-companion="${bot.id}">Stop this Companion</button></article>`;
		})
		.join(
			"",
		)}</div><p class="muted">Stop pauses this Companion's routines and cancels its queued/running/approval work. Unresolved unknown work remains visible. Companions do not delegate to each other.</p>`;
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
		: '<p class="muted">Preview the current task before sending or scheduling. No work has been submitted.</p>';
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
	root.innerHTML = `<aside><div class="brand">◌ Orbit Nest</div><p class="muted">A little help, close to home.</p><button data-view="home" class="nav ${view === "home" ? "selected" : ""}">Home</button><h4>Your companions</h4>${bots()
		.map(
			(b) =>
				`<button class="nav ${view === b.id ? "selected" : ""}" data-view="${b.id}">${b.id === "research" ? "◈" : "▤"} ${htmlText(b.name)}</button>`,
		)
		.join(
			"",
		)}<div class="local"><strong>Execution: Local</strong><p>${htmlText(health)}</p><button id="health" class="secondary">Check local models</button><small>Closing the window keeps work running. Quit, sleep or poweroff pauses execution. Missed intervals combine into one run on return.</small></div></aside><main><header><p class="eyebrow">YOUR LOCAL WORKSPACE</p><h1>${htmlText(selected?.name ?? "Welcome home")}</h1><p class="muted">${selected ? "Give your companion a clear task and a small, trusted scope." : "See what is happening, review results, and stay in control."}</p></header>${error ? `<p role="alert" class="error">${htmlText(error)}</p>` : ""}${selected ? `${modelSetup(current ?? selected)}<section><details id="settings" ${settingsOpen ? "open" : ""}><summary>Customize Companion · profile, memory & permissions</summary><h3>Identity</h3><label>Name<input id="name" value="${htmlText(selected.name)}"></label><label>Personality<textarea id="personality">${htmlText(selected.personality)}</textarea></label><label>Tone<input id="tone" value="${htmlText(selected.tone)}"></label><label>Role<textarea id="role">${htmlText(selected.role)}</textarea></label><h3>Memory</h3><label>Inspectable memory<textarea id="memory">${htmlText(selected.memory)}</textarea></label><h3>Allowed sources & tools</h3><p class="muted">Local model only. Read-only source access. No shell, file editing or cloud fallback. Memory proposals require approval.</p>${selected.id === "documents" ? `<p>Read-only folder: ${htmlText(selected.folder ?? "None selected")}</p><button id="folder">Choose folder</button><button id="revoke-folder" class="secondary">Remove folder access</button><p class="muted">Explicit top-level .md, .adoc, .asciidoc and .txt manuscripts. No recursion or source changes.</p><p>Selected: ${htmlText(selected.selectedFiles?.join(", ") || "None")}</p><button id="list-files" class="secondary">Refresh manuscript list</button>${(inventories.get(selected.id) ?? []).map((name) => `<label><input type="checkbox" data-file="${htmlText(name)}" ${selected.selectedFiles?.includes(name) ? "checked" : ""}>${htmlText(name)}</label>`).join("")}<button id="select-files" class="secondary">Save manuscript selection</button>` : `<label>Explicit public page<input id="page" value="${htmlText(selected.page ?? "")}" placeholder="https://example.com/"></label><p class="muted">HTTPS only: example.com, introducing.muse.ai, docs.x.ai. No redirects.</p>`}<button id="save">Save profile</button><button id="reload-profile" class="secondary">Reload current profile</button></details></section><section><label>What would you like help with?<textarea id="prompt" placeholder="Summarize this source and highlight what deserves attention."></textarea></label><div class="row"><select id="mode" aria-label="Task mode"><option value="chat">Local chat · no source reading</option><option value="${selected.id === "documents" ? "writing-review" : "summary"}">${selected.id === "documents" ? "Review selected manuscripts" : "Check selected public page"}</option></select><button id="preview">Preview task</button><button id="run" ${proposals.has(selected.id) ? "" : "disabled"}>Send</button><select id="minutes" aria-label="Schedule interval"><option value="1">Every minute (trial)</option><option value="15">Every 15 minutes</option><option value="60">Every hour</option><option value="1440">Every 24 hours</option></select><button class="secondary" id="schedule" ${proposals.has(selected.id) ? "" : "disabled"}>Schedule task</button></div><div id="proposal">${proposalMarkup(selected.id)}</div></section>` : `${companionCards()}<div class="stats"><section><strong>${state.runs.filter((r) => r.status === "running" || r.status === "queued").length}</strong><p>Active work</p></section><section><strong>${state.runs.filter((r) => r.status === "approval").length}</strong><p>Awaiting your approval</p></section><section><strong>${state.runs.filter((r) => r.status === "succeeded").length}</strong><p>Completed results</p></section></div>`}<h2>Routines</h2>${
		state.schedules
			.filter(
				(s) =>
					!selected || (s.payload as { botId: string }).botId === selected.id,
			)
			.map(
				(s) =>
					`<section class="row"><span>${htmlText((s.payload as { prompt: string }).prompt)}<br><p class="scope">Planned scope: ${htmlText(scopeLabel(s.payload))}</p><small>${s.paused ? "Paused" : `Next: ${new Date(s.next).toLocaleString()}`} · Missed runs: coalesce latest</small></span><button class="secondary" data-run-routine="${s.id}">Run now</button><button class="secondary" data-pause="${s.id}" data-paused="${!s.paused}">${s.paused ? "Resume" : "Pause"}</button></section>`,
			)
			.join("") ||
		'<p class="muted">No routines yet. Start with a task in either Bot.</p>'
	}<h2>${selected ? "Conversation & history" : "Activity, results & approvals"}</h2><div id="activity">${activity()}</div></main>`;
	for (const b of root.querySelectorAll<HTMLButtonElement>("[data-view]")) {
		b.onclick = () => {
			view = b.dataset.view ?? "home";
			editing = false;
			render();
		};
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
			const proposal = proposals.get(selected.id);
			if (!proposal) return;
			const prompt = value("prompt");
			(document.getElementById("run") as HTMLButtonElement).disabled = true;
			(document.getElementById("schedule") as HTMLButtonElement).disabled =
				true;
			editing = false;
			void call("run", {
				id: selected.id,
				prompt,
				mode: value("mode"),
				requestId: proposal.requestId,
				previewToken: proposal.preview.token,
			});
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
							true;
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
	setInterval(() => void refresh(), 1000);
})();
