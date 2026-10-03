import type {
	ScheduledRun,
	WorkState,
} from "@cybergarage/orbit/dist/core/execution/scheduled-work.js";
import type { Bot } from "./runtime";

declare global {
	interface Window {
		nest: {
			call(
				command: string,
				input?: unknown,
			): Promise<WorkState | string | string[]>;
		};
	}
}
let state: WorkState;
let view = "home";
let editing = false;
const drafts = new Map<string, Record<string, string>>();
const revisions = new Map<string, number>();
const inventories = new Map<string, string[]>();
let health = "Checking local model…";
let error = "";
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
	try {
		await window.nest.call(command, input);
		if (["save", "select-files", "folder", "revoke-folder"].includes(command))
			editing = false;
		if (command === "folder" || command === "revoke-folder")
			inventories.delete((input as { id: string }).id);
		if (command === "save") {
			const id = (input as { id: string }).id;
			drafts.delete(id);
			revisions.delete(id);
		}
		error = "";
		await refresh();
	} catch (e) {
		error = e instanceof Error ? e.message : String(e);
		render();
	}
}
const bots = (): Bot[] => state.data.bots as Bot[];
function card(run: ScheduledRun): string {
	const p = run.payload as { botId?: string; prompt?: string };
	const bot = bots().find((b) => b.id === p.botId);
	return `<article class="result"><div class="row"><strong>${htmlText(bot?.name ?? "Bot")}</strong><span class="badge ${run.status}">${htmlText(run.status)}</span></div><p>${htmlText(p.prompt ?? "Memory update")}</p>${run.approval && run.status === "approval" ? `<pre>${htmlText(run.approval.preview)}</pre><button data-approve="${htmlText(run.id)}">Approve memory replacement</button><button class="secondary" data-deny="${htmlText(run.id)}">Reject</button>` : ""}${run.result ? `<pre>${htmlText(run.result)}</pre>` : ""}${run.status === "succeeded" && p.prompt ? `<button class="secondary" data-remember="${htmlText(run.id)}">Review saving to memory</button>` : ""}${["queued", "running", "approval"].includes(run.status) ? `<button class="secondary" data-cancel="${htmlText(run.id)}">Cancel</button>` : ""}${run.status === "unknown" ? `<p>Interrupted operation. Automatic replay is blocked.</p><button class="secondary" data-reconcile="${htmlText(run.id)}">Confirm stopped and close unresolved work</button>` : ""}<details><summary>Execution evidence</summary><small>Request ${htmlText(run.requestId)}<br>${state.attempts
		.filter((a) => a.runId === run.id)
		.map((a) => `${htmlText(a.id)} · ${htmlText(a.status)}`)
		.join("<br>")}</small></details></article>`;
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
	const runs = state.runs
		.filter(
			(r) =>
				!selected || (r.payload as { botId?: string }).botId === selected.id,
		)
		.slice()
		.reverse();
	root.innerHTML = `<aside><div class="brand">◌ Orbit Nest</div><p class="muted">A little help, close to home.</p><button data-view="home" class="nav ${view === "home" ? "selected" : ""}">Home</button><h4>Your companions</h4>${bots()
		.map(
			(b) =>
				`<button class="nav ${view === b.id ? "selected" : ""}" data-view="${b.id}">${b.id === "research" ? "◈" : "▤"} ${htmlText(b.name)}</button>`,
		)
		.join(
			"",
		)}<div class="local"><strong>Local first</strong><p>${htmlText(health)}</p><small>Closing the window keeps work running. Quit, sleep or poweroff pauses execution. Missed intervals combine into one run on return.</small></div></aside><main><header><p class="eyebrow">YOUR LOCAL WORKSPACE</p><h1>${htmlText(selected?.name ?? "Welcome home")}</h1><p class="muted">${selected ? "Give your companion a clear task and a small, trusted scope." : "See what is happening, review results, and stay in control."}</p></header>${error ? `<p role="alert" class="error">${htmlText(error)}</p>` : ""}${selected ? `<section><details id="settings" ${settingsOpen ? "open" : ""}><summary>Customize Companion · profile, memory & permissions</summary><h3>Identity</h3><label>Name<input id="name" value="${htmlText(selected.name)}"></label><label>Personality<textarea id="personality">${htmlText(selected.personality)}</textarea></label><label>Tone<input id="tone" value="${htmlText(selected.tone)}"></label><label>Role<textarea id="role">${htmlText(selected.role)}</textarea></label><h3>Memory</h3><label>Inspectable memory<textarea id="memory">${htmlText(selected.memory)}</textarea></label><h3>Allowed sources & tools</h3><p class="muted">Local model only. Read-only source access. No shell, file editing or cloud fallback. Memory proposals require approval.</p>${selected.id === "documents" ? `<p>Read-only folder: ${htmlText(selected.folder ?? "None selected")}</p><button id="folder">Choose folder</button><button id="revoke-folder" class="secondary">Remove folder access</button><p class="muted">Explicit top-level .md, .adoc, .asciidoc and .txt manuscripts. No recursion or source changes.</p><p>Selected: ${htmlText(selected.selectedFiles?.join(", ") || "None")}</p><button id="list-files" class="secondary">Refresh manuscript list</button>${(inventories.get(selected.id) ?? []).map((name) => `<label><input type="checkbox" data-file="${htmlText(name)}" ${selected.selectedFiles?.includes(name) ? "checked" : ""}>${htmlText(name)}</label>`).join("")}<button id="select-files" class="secondary">Save manuscript selection</button>` : `<label>Explicit public page<input id="page" value="${htmlText(selected.page ?? "")}" placeholder="https://example.com/"></label><p class="muted">HTTPS only: example.com, introducing.muse.ai, docs.x.ai. No redirects.</p>`}<button id="save">Save profile</button><button id="reload-profile" class="secondary">Reload current profile</button></details></section><section><label>What would you like help with?<textarea id="prompt" placeholder="Summarize this source and highlight what deserves attention."></textarea></label><div class="row"><select id="mode" aria-label="Task mode"><option value="chat">Local chat · no source reading</option><option value="${selected.id === "documents" ? "writing-review" : "summary"}">${selected.id === "documents" ? "Review selected manuscripts" : "Check selected public page"}</option></select><button id="run">Send</button><select id="minutes" aria-label="Schedule interval"><option value="1">Every minute (trial)</option><option value="15">Every 15 minutes</option><option value="60">Every hour</option><option value="1440">Every 24 hours</option></select><button class="secondary" id="schedule">Schedule task</button></div></section>` : `<div class="stats"><section><strong>${state.runs.filter((r) => r.status === "running" || r.status === "queued").length}</strong><p>Active work</p></section><section><strong>${state.runs.filter((r) => r.status === "approval").length}</strong><p>Awaiting your approval</p></section><section><strong>${state.runs.filter((r) => r.status === "succeeded").length}</strong><p>Completed results</p></section></div>`}<h2>Routines</h2>${
		state.schedules
			.filter(
				(s) =>
					!selected || (s.payload as { botId: string }).botId === selected.id,
			)
			.map(
				(s) =>
					`<section class="row"><span>${htmlText((s.payload as { prompt: string }).prompt)}<br><small>${s.paused ? "Paused" : `Next: ${new Date(s.next).toLocaleString()}`} · Missed runs: coalesce latest</small></span><button class="secondary" data-run-routine="${s.id}">Run now</button><button class="secondary" data-pause="${s.id}" data-paused="${!s.paused}">${s.paused ? "Resume" : "Pause"}</button></section>`,
			)
			.join("") ||
		'<p class="muted">No routines yet. Start with a task in either Bot.</p>'
	}<h2>${selected ? "Conversation & history" : "Activity, results & approvals"}</h2>${runs.map(card).join("") || '<section class="empty">Choose a companion, select a source, and try your first task.</section>'}</main>`;
	for (const b of root.querySelectorAll<HTMLButtonElement>("[data-view]")) {
		b.onclick = () => {
			view = b.dataset.view ?? "home";
			editing = false;
			render();
		};
	}
	const bind = (
		attribute: string,
		command: string,
		extra: (b: HTMLButtonElement) => object = () => ({}),
	): void => {
		for (const b of root.querySelectorAll<HTMLButtonElement>(
			`[data-${attribute}]`,
		)) {
			b.onclick = () => {
				void call(command, {
					id: b.getAttribute(`data-${attribute}`),
					...extra(b),
				});
			};
		}
	};
	bind("approve", "approve", () => ({ allow: true }));
	bind("deny", "approve", () => ({ allow: false }));
	bind("cancel", "cancel");
	bind("run-routine", "run-routine");
	bind("remember", "remember");
	bind("pause", "pause", (b) => ({ paused: b.dataset.paused === "true" }));
	bind("reconcile", "reconcile");
	const value = (id: string): string =>
		(document.getElementById(id) as HTMLInputElement)?.value ?? "";
	const button = (id: string, action: () => void): void => {
		const b = document.getElementById(id);
		if (b) b.onclick = action;
	};
	if (selected) {
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
			const prompt = value("prompt");
			editing = false;
			void call("run", {
				id: selected.id,
				prompt,
				mode: value("mode"),
				requestId: crypto.randomUUID(),
			});
		});
		button("schedule", () => {
			const prompt = value("prompt");
			editing = false;
			void call("schedule", {
				id: selected.id,
				prompt,
				mode: value("mode"),
				minutes: Number(value("minutes")),
			});
		});
	}
	root.querySelectorAll("input,textarea,select").forEach(
		(e) =>
			void e.addEventListener("input", () => {
				editing = true;
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
	state = (await window.nest.call("state")) as WorkState;
	if (!editing) render();
}
void (async () => {
	await refresh();
	health = (await window.nest.call("health")) as string;
	render();
	setInterval(() => void refresh(), 1000);
})();
