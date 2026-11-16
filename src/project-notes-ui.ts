import type { ProjectMemoryEntry } from "@cybergarage/orbit/dist/core/projects/types.js";
import type { ProjectContextSnapshot } from "@cybergarage/orbit/dist/core/projects/memory-context.js";
import type { ContextTarget } from "./context-target";
import type { NoteChange, NoteHistory, NotesInspection } from "./project-notes";
type Draft = NoteChange;
interface PanelState {
	draft?: Draft;
	createBody: string;
	createOperation?: string;
	error?: string;
	history?: NoteHistory;
	historyOpen?: boolean;
	open?: boolean;
	previewOpen?: boolean;
	busy: boolean;
}
interface Actions {
	send(command: string, input: object): Promise<unknown>;
	reload(): Promise<void>;
	repaint(): void;
	current(): NotesInspection;
}
const panels = new Map<string, PanelState>();
const key = (target: ContextTarget) =>
	JSON.stringify([
		target.botId,
		target.projectId,
		target.sessionId,
		target.membershipRevision,
	]);
function panel(target: ContextTarget): PanelState {
	const id = key(target);
	let value = panels.get(id);
	if (!value) {
		value = { createBody: "", busy: false };
		panels.set(id, value);
	}
	return value;
}
const htmlText = (value: string | null | undefined): string =>
	(value ?? "").replace(
		/[&<>"']/g,
		(character) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				character
			] ?? character,
	);
function historyNotes(
	view: NotesInspection,
	state: PanelState,
): ProjectMemoryEntry[] {
	const history = state.history;
	return history && history.generation === view.preview?.generation
		? history.notes
		: view.inactive;
}
function noteRow(
	note: ProjectMemoryEntry,
	view: NotesInspection,
	busy: boolean,
): string {
	const included = view.preview?.entries.some((entry) => entry.id === note.id);
	const reason = view.preview?.exclusions.find(
		(entry) => entry.id === note.id,
	)?.reason;
	let status = "Excluded: inactive";
	if (!note.retired)
		status = included
			? "Included in current note preview"
			: `Excluded: ${reason ?? "not selected"}`;
	const disabled = busy ? "disabled" : "";
	const deactivate = note.retired
		? ""
		: `<button class="secondary" data-note-deactivate="${htmlText(note.id)}" ${disabled}>Deactivate note</button>`;
	return `<article class="result" data-project-note="${htmlText(note.id)}"><strong>${htmlText(note.title)}</strong><p>${htmlText(status)} · revision ${note.revision}</p><pre>${htmlText(note.body)}</pre><small>Note ${htmlText(note.id)}</small><div class="row"><button class="secondary" data-note-correct="${htmlText(note.id)}" ${disabled}>Correct note</button>${deactivate}</div></article>`;
}
function draftMarkup(draft: Draft, busy: boolean): string {
	const disabled = busy ? "disabled" : "";
	const control =
		draft.action === "correct"
			? `<label>Corrected note text<textarea id="note-correction-body" maxlength="8000" ${disabled}>${htmlText(draft.body)}</textarea></label>`
			: `<p>This note will remain stored and become ineligible for future context. Existing transcripts and captured evidence are retained.</p><pre>${htmlText(draft.body)}</pre>`;
	const label =
		draft.action === "correct" ? "Save correction" : "Confirm deactivate";
	return `<section aria-label="Review Project note change"><h3>Review Project note change</h3><p>Revision ${draft.expectedRevision} · Project generation ${draft.generation}</p>${control}<div class="row"><button id="note-change-confirm" ${disabled}>${label}</button><button class="secondary" id="note-change-cancel" ${disabled}>Cancel note change</button></div></section>`;
}
function historyControls(
	next: string | undefined,
	history: boolean,
	busy: boolean,
): string {
	const disabled = busy ? "disabled" : "";
	const nextButton = next
		? `<button class="secondary" id="note-history-next" ${disabled}>Next inactive notes</button>`
		: "";
	const firstButton = history
		? `<button class="secondary" id="note-history-first" ${disabled}>First inactive notes</button>`
		: "";
	return firstButton + nextButton;
}
export function projectNotesMarkup(view: NotesInspection): string {
	if (!view.target || !view.preview)
		return view.noteError
			? `<p role="alert">Project notes unavailable: ${htmlText(view.noteError)}</p>`
			: "";
	const state = panel(view.target),
		inactive = historyNotes(view, state);
	const history =
		state.history?.generation === view.preview.generation
			? state.history
			: undefined;
	const next = history ? history.next : view.inactiveNext;
	const notes = view.notes
		.map((note) => noteRow(note, view, state.busy))
		.join("");
	const inactiveRows = inactive
		.map((note) => noteRow(note, view, state.busy))
		.join("");
	const historyButtons = historyControls(next, Boolean(history), state.busy);
	const draft = state.draft ? draftMarkup(state.draft, state.busy) : "";
	const error = state.error
		? `<p role="alert">${htmlText(state.error)}</p>`
		: "";
	return `<details id="project-notes-panel" ${state.open || state.draft || state.history || state.error ? "open" : ""}><summary>Project notes</summary><p class="muted">Human-authored context, not permissions. Notes are shared only within this Project. Changes use the displayed note revision and Project generation. Inactive notes are retained, not deleted.</p>${error}${draft}<h3>Active notes</h3>${notes || "<p>No active notes.</p>"}<details id="inactive-project-notes" ${state.historyOpen ? "open" : ""}><summary>Inactive notes</summary><p>Up to 50 stored inactive notes per page. Corrections keep inactive notes inactive.</p>${inactiveRows || "<p>No inactive notes on this page.</p>"}${historyButtons}</details><details id="project-note-preview" ${state.previewOpen ? "open" : ""}><summary>Current Project note context</summary><p>Generation ${view.preview.generation} · Notes included: ${view.preview.entries.length} · ${view.preview.tokens} / 2,048 tokens</p><p>This is the Project-note portion only. A chat also uses this Bot's persona and up to eight messages from the selected Session. The actual execution captures its own generation; this preview grants no tools or permissions.</p><pre>${htmlText(view.preview.rendered)}</pre></details><label>New Project note<textarea id="project-note" maxlength="8000" ${state.busy ? "disabled" : ""}>${htmlText(state.createBody)}</textarea></label><button id="project-note-create" class="secondary" ${state.busy ? "disabled" : ""}>Save Project note</button></details>`;
}
export function bindProjectNotes(
	root: HTMLElement,
	view: NotesInspection,
	actions: Actions,
): void {
	if (!view.target || !view.preview) return;
	const target = view.target,
		generation = view.preview.generation,
		state = panel(target);
	const bind = (id: string, action: () => void) => {
		const element = root.querySelector<HTMLButtonElement>(`#${id}`);
		if (element) element.onclick = action;
	};

	for (const [id, property] of [
		["project-notes-panel", "open"],
		["inactive-project-notes", "historyOpen"],
		["project-note-preview", "previewOpen"],
	] as const) {
		const disclosure = root.querySelector<HTMLDetailsElement>(`#${id}`);
		if (disclosure)
			disclosure.ontoggle = () => {
				if (disclosure.isConnected) state[property] = disclosure.open;
			};
	}
	const entries = [...view.notes, ...historyNotes(view, state)];
	for (const action of ["correct", "deactivate"] as const) {
		for (const element of root.querySelectorAll<HTMLButtonElement>(
			`[data-note-${action}]`,
		))
			element.onclick = () => {
				const note = entries.find(
					(note) => note.id === element.getAttribute(`data-note-${action}`),
				);
				if (!note || state.busy) return;
				state.open = true;
				state.draft = {
					target,
					generation,
					expectedRevision: note.revision,
					noteId: note.id,
					body: note.body,
					action,
					operationId: crypto.randomUUID(),
				};
				state.error = undefined;
				actions.repaint();
			};
	}
	const correction = root.querySelector<HTMLTextAreaElement>(
		"#note-correction-body",
	);
	if (correction)
		correction.oninput = () => {
			if (!state.busy && state.draft && state.draft.body !== correction.value) {
				state.draft.body = correction.value;
				state.draft.operationId = crypto.randomUUID();
			}
		};
	const creation = root.querySelector<HTMLTextAreaElement>("#project-note");
	if (creation)
		creation.oninput = () => {
			if (state.busy) return;
			if (state.createBody !== creation.value)
				state.createOperation = undefined;
			state.createBody = creation.value;
		};
	bind("note-change-cancel", () => {
		if (!state.busy) {
			state.draft = undefined;
			state.error = undefined;
			actions.repaint();
		}
	});
	const save = async (command: string, input: object, complete: () => void) => {
		if (state.busy) return;
		state.busy = true;
		state.error = undefined;
		actions.repaint();
		try {
			await actions.send(command, input);
			complete();
		} catch (error) {
			state.error = error instanceof Error ? error.message : String(error);
		} finally {
			state.busy = false;
			try {
				await actions.reload();
			} catch (error) {
				state.error = error instanceof Error ? error.message : String(error);
			}
			actions.repaint();
		}
	};
	bind("note-change-confirm", () => {
		const draft = state.draft && { ...state.draft };
		if (!draft) return;
		void save("project-note-change", { id: target.botId, ...draft }, () => {
			if (state.draft?.operationId === draft.operationId)
				state.draft = undefined;
			state.history = undefined;
		});
	});
	bind("project-note-create", () => {
		state.createOperation ??= crypto.randomUUID();
		void save(
			"project-note",
			{
				id: target.botId,
				target,
				generation,
				sessionId: target.sessionId,
				body: state.createBody,
				operationId: state.createOperation,
			},
			() => {
				state.createBody = "";
				state.createOperation = undefined;
				state.history = undefined;
			},
		);
	});
	bind("note-history-first", () => {
		if (state.busy) return;
		state.history = undefined;
		state.historyOpen = true;
		actions.repaint();
	});
	// Page loading uses a separate read path so its response cannot replace notes or a draft.
	const next = root.querySelector<HTMLButtonElement>("#note-history-next");
	if (next)
		next.onclick = () => {
			const history =
				state.history?.generation === generation ? state.history : undefined;
			const after = history ? history.next : view.inactiveNext;
			if (!after || state.busy) return;
			state.busy = true;
			actions.repaint();
			void actions
				.send("project-note-history", { id: target.botId, target, after })
				.then((result) => {
					const page = result as NoteHistory;
					if (key(page.target) !== key(target))
						throw new Error("Project note history target changed");
					if (page.generation === actions.current().preview?.generation)
						state.history = page;
				})
				.catch((error) => {
					state.error = error instanceof Error ? error.message : String(error);
				})
				.finally(() => {
					state.busy = false;
					actions.repaint();
				});
		};
}
export function capturedNotesMarkup(snapshot: ProjectContextSnapshot): string {
	const entries = snapshot.entries
		.map(
			(entry) =>
				`<li>${htmlText(entry.title)} · revision ${entry.revision} · ${htmlText(entry.id)}</li>`,
		)
		.join("");
	const excluded = snapshot.exclusions
		.map(
			(entry) => `<li>${htmlText(entry.id)} · ${htmlText(entry.reason)}</li>`,
		)
		.join("");
	return `<details><summary>Captured Project note context</summary><p>Generation ${snapshot.generation} · ${snapshot.tokens} tokens · Session ${htmlText(snapshot.sessionId)}</p><ul>${entries}</ul><p>Excluded:</p><ul>${excluded}</ul><pre>${htmlText(snapshot.rendered)}</pre><p>Historical execution evidence. Later note corrections do not rewrite this capture.</p></details>`;
}
