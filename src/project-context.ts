import type {
	NoteGuard,
	NoteChange,
	NoteHistory,
	NotesInspection,
} from "./project-notes";
import fs from "node:fs";
import { Agent } from "@cybergarage/orbit/dist/core/agent.js";
import { SessionContextBuilder } from "@cybergarage/orbit/dist/core/session/context-builder.js";
import { State } from "@cybergarage/orbit/dist/core/state.js";
import { MemorySessionLogStore } from "@cybergarage/orbit/dist/core/logs/memory-store.js";
import { createMcpToolManager } from "@cybergarage/orbit/dist/core/mcp.js";
import type { Model } from "@cybergarage/orbit/dist/core/models/model.js";
import path from "node:path";
import { createHash } from "node:crypto";
import { SqliteProjectStore } from "@cybergarage/orbit/dist/core/projects/sqlite-store.js";
import { ProjectService } from "@cybergarage/orbit/dist/core/projects/service.js";
import { ProjectMemoryService } from "@cybergarage/orbit/dist/core/projects/memory-service.js";
import { SessionRepository } from "@cybergarage/orbit/dist/core/session/repository.js";
import { Message } from "@cybergarage/orbit/dist/core/message/message.js";
import type { Session } from "@cybergarage/orbit/dist/core/session/session.js";
import type {
	DurableWorkStore,
	ScheduledRun,
} from "@cybergarage/orbit/dist/core/execution/scheduled-work.js";
import type { ProjectContextSnapshot } from "@cybergarage/orbit/dist/core/projects/memory-context.js";
import { canonicalJSON } from "@cybergarage/orbit/dist/core/execution/canonical-json.js";
import type { ChatMessage } from "./models";

import { capturedContext, type ContextTarget } from "./context-target";
export type { ContextTarget } from "./context-target";
interface Operation {
	id: string;
	botId: string;
	kind: "project" | "session";
	name: string;
	projectId?: string;
	done?: boolean;
}
interface ContextData {
	version: 1;
	operations: Operation[];
	projects: { botId: string; projectId: string; name: string }[];
	sessions: (ContextTarget & { name: string })[];
	selected: { botId: string; sessionId: string }[];
	projected: { runId: string; digest: string }[];
}
interface ResultProjection {
	runId: string;
	attemptId: string;
	target: ContextTarget;
	prompt: string;
	result: string;
	fingerprint: string;
}
export interface ContextLease {
	chat?(
		model: Model,
		system: string,
		prompt: string,
		signal: AbortSignal,
	): Promise<string>;
	history: ChatMessage[];
	memory: string;
	validate(): Promise<void>;
	commit(action: () => void): Promise<void>;
	close(): Promise<void>;
}
export interface ContextHost {
	store: DurableWorkStore;
	bot(id: string): {
		model: string;
		provider?: string;
		profileRevision?: number;
	};
	canSearchProjectMemory?(botId: string): boolean;
}
const UUID =
	/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
function uuid(value: unknown): asserts value is string {
	if (typeof value !== "string" || !UUID.test(value))
		throw new Error("Invalid context operation or identity");
}
function text(value: unknown): asserts value is string {
	if (typeof value !== "string" || !value.trim() || value.length > 100)
		throw new Error("Enter a name of 1–100 characters");
}
const digest = (value: unknown) =>
	createHash("sha256").update(canonicalJSON(value)).digest("hex");
const messageId = (runId: string, role: string) => {
	const hash = digest(["nest-result", runId, role]);
	return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};

/** Host-owned Project bindings and canonical memory. No renderer-supplied grants. */
export class ProjectContext {
	readonly repository: SessionRepository;
	readonly projects: ProjectService;
	readonly memory: ProjectMemoryService;
	private queue: Promise<unknown> = Promise.resolve();
	private readonly active = new Map<string, Session>();
	private closing = false;
	private constructor(
		private readonly host: ContextHost,
		private readonly catalog: SqliteProjectStore,
		root: string,
		private readonly checkpoint?: (
			stage:
				| "result-saved"
				| "transcript-saved"
				| "session-created"
				| "user-message-saved"
				| "note-saved",
			runId: string,
		) => Promise<void>,
	) {
		this.repository = new SessionRepository({
			rootDir: path.join(root, "sessions"),
			journalRoot: path.join(root, "runs"),
		});
		const inspection = this.repository.inspectStorage();
		if (
			inspection.state === "unregistered" &&
			[this.repository.rootDir, this.repository.journalRoot].every(
				(dir) => !fs.existsSync(dir) || fs.readdirSync(dir).length === 0,
			)
		) {
			// New, empty, app-owned roots have no writers or automatic restarters.
			this.repository.initializeStorage({
				allWritersStopped: true,
				automaticRestartersDisabled: true,
				exclusiveStorageControl: true,
			});
		} else if (inspection.state !== "ready")
			throw new Error(
				"Context storage requires offline registration inspection; existing evidence was preserved",
			);
		const sessionHost = {
			closeThread: async () => {},
			getThread: (id: string) =>
				this.active.has(id) ? { status: "running" } : undefined,
		};
		this.projects = new ProjectService(
			catalog,
			this.repository,
			sessionHost,
			root,
		);
		this.memory = new ProjectMemoryService(this.projects, sessionHost);
		this.data();
	}
	static async open(
		root: string,
		host: ContextHost,
		checkpoint?: (
			stage:
				| "result-saved"
				| "transcript-saved"
				| "session-created"
				| "user-message-saved"
				| "note-saved",
			runId: string,
		) => Promise<void>,
	): Promise<ProjectContext> {
		fs.mkdirSync(root, { recursive: true });
		const catalog = await SqliteProjectStore.open({
			file: path.join(root, "projects.sqlite"),
		});
		let context: ProjectContext | undefined;
		try {
			context = new ProjectContext(host, catalog, root, checkpoint);
			try {
				await context.resumeOperations();
			} catch (error) {
				host.store.setData(
					"contextRecoveryError",
					error instanceof Error
						? error.message
						: "Context creation recovery blocked",
				);
			}
			return context;
		} catch (error) {
			if (context) await context.memory.close();
			await catalog.close();
			throw error;
		}
	}
	private serial<T>(action: () => Promise<T>): Promise<T> {
		if (this.closing)
			return Promise.reject(new Error("Project context is closing"));
		const next = this.queue.then(action);
		this.queue = next.catch(() => {});
		return next;
	}
	private data(): ContextData {
		const raw = this.host.store.snapshot().data.projectContext;
		if (raw === undefined)
			return {
				version: 1,
				operations: [],
				projects: [],
				sessions: [],
				selected: [],
				projected: [],
			};
		const value = raw as ContextData;
		if (
			value?.version !== 1 ||
			![
				value.operations,
				value.projects,
				value.sessions,
				value.selected,
				value.projected,
			].every(Array.isArray)
		)
			throw new Error("Corrupt Nest context state; inspection required");
		for (const project of value.projects) {
			uuid(project.projectId);
			this.host.bot(project.botId);
			text(project.name);
		}
		for (const session of value.sessions) {
			this.checkTarget(session);
			text(session.name);
		}
		for (const operation of value.operations) this.checkOperation(operation);
		if (
			new Set(value.operations.map((op) => op.id)).size !==
				value.operations.length ||
			new Set(value.sessions.map((s) => s.sessionId)).size !==
				value.sessions.length
		)
			throw new Error("Duplicate context identity");
		this.checkSelections(value);
		this.checkProjectionReceipts(value.projected);
		return value;
	}
	private checkOperation(operation: Operation): void {
		uuid(operation.id);
		this.host.bot(operation.botId);
		text(operation.name);
		if (!["project", "session"].includes(operation.kind))
			throw new Error("Corrupt context operation");
		if (operation.kind === "session") uuid(operation.projectId);
	}
	private checkSelections(value: ContextData): void {
		for (const selection of value.selected)
			if (
				!value.sessions.some(
					(s) =>
						s.sessionId === selection.sessionId && s.botId === selection.botId,
				)
			)
				throw new Error("Invalid selected context");
	}
	private checkProjectionReceipts(receipts: ContextData["projected"]): void {
		for (const receipt of receipts)
			if (
				typeof receipt.runId !== "string" ||
				!/^[a-f\d]{64}$/.test(receipt.digest)
			)
				throw new Error("Invalid context projection evidence");
	}

	private save(value: ContextData): void {
		this.host.store.setData("projectContext", value);
	}
	private checkTarget(target: ContextTarget): void {
		if (!target || typeof target !== "object")
			throw new Error("Invalid context target");
		this.host.bot(target.botId);
		uuid(target.projectId);
		uuid(target.sessionId);
		if (
			!Number.isSafeInteger(target.membershipRevision) ||
			target.membershipRevision < 1
		)
			throw new Error("Invalid membership revision");
	}
	selection(botId: string): ContextTarget | undefined {
		const data = this.data();
		const selected = data.selected.find((s) => s.botId === botId);
		const target = data.sessions.find(
			(s) => s.sessionId === selected?.sessionId && s.botId === botId,
		);
		return (
			target && {
				botId,
				projectId: target.projectId,
				sessionId: target.sessionId,
				membershipRevision: target.membershipRevision,
				projectName:
					data.projects.find(
						(project) => project.projectId === target.projectId,
					)?.name ?? "Project",
				sessionName:
					this.repository.getTitle(target.sessionId).title ?? target.name,
			}
		);
	}
	view(botId: string) {
		return this.serial(() => this.inspectView(botId));
	}
	private async inspectView(botId: string) {
		this.host.bot(botId);
		const data = this.data();
		const projects = [];
		for (const binding of data.projects.filter((p) => p.botId === botId)) {
			const project = await this.catalog.query({
				kind: "project",
				id: binding.projectId,
			});
			if (project && !project.archived)
				projects.push({ id: project.id, name: project.name });
		}
		const selected = this.selection(botId);
		let inspection: NotesInspection = { notes: [], inactive: [] };
		if (selected) {
			try {
				inspection = await this.inspectNotes(selected);
			} catch (error) {
				inspection.noteError =
					error instanceof Error
						? error.message
						: "Project notes need inspection";
			}
		}

		return {
			projects,
			sessions: data.sessions
				.filter((s) => s.botId === botId)
				.map((s) => ({
					...s,
					name: this.repository.getTitle(s.sessionId).title ?? s.name,
				})),
			selected: selected?.sessionId ?? "",
			...inspection,
		};
	}
	private selectedNoteTarget(
		botId: string,
		target: ContextTarget,
	): ContextTarget {
		this.checkTarget(target);
		const current = this.selection(botId);
		if (
			target.botId !== botId ||
			current?.projectId !== target.projectId ||
			current.sessionId !== target.sessionId ||
			current.membershipRevision !== target.membershipRevision
		)
			throw new Error(
				"Project note target changed; select and review the intended conversation",
			);
		return current;
	}
	private async noteGeneration(target: ContextTarget): Promise<number> {
		const project = await this.catalog.query({
			kind: "project",
			id: target.projectId,
		});
		if (!project || project.archived)
			throw new Error("Project notes are unavailable");
		return project.memoryGeneration;
	}
	private async inactivePage(
		target: ContextTarget,
		after?: string,
	): Promise<NoteHistory> {
		const entries = await this.catalog.query({
			kind: "memories",
			projectId: target.projectId,
			retired: true,
			limit: 51,
			...(after ? { after } : {}),
		});
		return {
			target,
			generation: await this.noteGeneration(target),
			notes: entries.slice(0, 50),
			...(entries.length > 50 ? { next: entries[49].id } : {}),
		};
	}
	private async inspectNotes(target: ContextTarget): Promise<NotesInspection> {
		await this.validate(target);
		const preview = await this.memory.prepare(
			target.sessionId,
			"nest-project-notes-preview",
			{ mode: "curated" },
			{ capture: false },
		);
		const notes = await this.catalog.query({
			kind: "memories",
			projectId: target.projectId,
			retired: false,
		});
		const history = await this.inactivePage(target);
		if (preview.generation !== history.generation)
			throw new Error("Project notes changed during inspection; refresh them");
		await this.validate(target);
		return {
			target,
			notes,
			inactive: history.notes,
			inactiveNext: history.next,
			preview,
		};
	}
	noteHistory(
		botId: string,
		target: ContextTarget,
		after?: string,
	): Promise<NoteHistory> {
		return this.serial(async () => {
			const current = this.selectedNoteTarget(botId, target);
			if (after !== undefined) uuid(after);
			await this.validate(current);
			const page = await this.inactivePage(current, after);
			await this.validate(current);
			return page;
		});
	}
	changeMemory(botId: string, input: NoteChange): Promise<void> {
		return this.serial(async () => {
			uuid(input.operationId);
			uuid(input.noteId);
			if (
				!["correct", "deactivate"].includes(input.action) ||
				!Number.isSafeInteger(input.expectedRevision) ||
				input.expectedRevision < 1 ||
				!Number.isSafeInteger(input.generation) ||
				input.generation < 0
			)
				throw new Error("Invalid Project note revision or operation");
			this.noteBody(input.body);
			const target = this.selectedNoteTarget(botId, input.target);
			await this.validate(target);
			const prior = await this.catalog.query({
				kind: "operation",
				id: input.operationId,
			});
			if (!prior && (await this.noteGeneration(target)) !== input.generation)
				throw new Error("Project notes changed; reload before saving");
			const saved = prior?.result;
			const entry =
				saved && "body" in saved
					? saved
					: await this.catalog.query({ kind: "memory", id: input.noteId });
			if (entry?.id !== input.noteId || entry.projectId !== target.projectId)
				throw new Error("Project note is not in the selected Project");
			if (input.action === "deactivate" && input.body !== entry.body)
				throw new Error("Deactivation preview changed; reload the saved note");
			await this.memory.edit(target.projectId, input.noteId, {
				operationId: input.operationId,
				expectedRevision: input.expectedRevision,
				title: entry.title,
				body: input.body,
				retired: entry.retired || input.action === "deactivate",
			});
			await this.checkpoint?.("note-saved", input.noteId);
		});
	}
	private noteBody(body: unknown): asserts body is string {
		if (
			typeof body !== "string" ||
			!body.trim() ||
			body.length > 8000 ||
			Buffer.byteLength(body) > 8192
		)
			throw new Error(
				"Enter a note of 1–8,000 characters and at most 8 KiB UTF-8",
			);
	}

	createProject(
		botId: string,
		name: string,
		operationId: string,
	): Promise<void> {
		return this.start({ id: operationId, botId, name, kind: "project" });
	}
	createSession(
		botId: string,
		projectId: string,
		name: string,
		operationId: string,
	): Promise<void> {
		uuid(projectId);
		return this.start({
			id: operationId,
			botId,
			projectId,
			name,
			kind: "session",
		});
	}
	private start(input: Operation): Promise<void> {
		return this.serial(async () => {
			uuid(input.id);
			text(input.name);
			this.host.bot(input.botId);
			const data = this.data(),
				prior = data.operations.find((op) => op.id === input.id);
			if (
				prior &&
				digest({
					id: prior.id,
					botId: prior.botId,
					name: prior.name,
					kind: prior.kind,
					...(prior.projectId ? { projectId: prior.projectId } : {}),
				}) !== digest(input)
			)
				throw new Error("Context operation ID reused with different input");
			if (!prior) {
				await this.checkNewOperation(input, data);
				data.operations.push(input);
				this.save(data);
			}
			await this.apply(prior ?? input);
		});
	}
	private async checkNewOperation(
		input: Operation,
		data: ContextData,
	): Promise<void> {
		if (input.kind === "session") {
			if (
				!data.projects.some(
					(binding) =>
						binding.botId === input.botId &&
						binding.projectId === input.projectId,
				)
			)
				throw new Error("Project is not associated with this Bot");
			const project = await this.catalog.query({
				kind: "project",
				id: input.projectId as string,
			});
			if (!project || project.archived)
				throw new Error("Project is unavailable or archived");
			const provider = this.host.bot(input.botId).provider;
			if (provider !== "apple" && provider !== "ollama")
				throw new Error("Select an explicit local provider first");
		}
		if (data.operations.length >= 200)
			throw new Error("Local context creation limit reached");
	}

	private async apply(operation: Operation): Promise<void> {
		if (operation.done) return;
		const data = this.data();
		if (operation.kind === "project") {
			const project = await this.projects.create({
				name: operation.name,
				operationId: operation.id,
			});
			if (!data.projects.some((p) => p.projectId === project.id))
				data.projects.push({
					botId: operation.botId,
					projectId: project.id,
					name: project.name,
				});
		} else {
			const projectId = operation.projectId;
			uuid(projectId);
			if (
				!data.projects.some(
					(p) =>
						p.botId === operation.botId && p.projectId === operation.projectId,
				)
			)
				throw new Error("Project is not associated with this Bot");
			const bot = this.host.bot(operation.botId);
			if (bot.provider !== "ollama" && bot.provider !== "apple")
				throw new Error("Select an explicit local provider first");
			const session = await this.projects.createSession(
				projectId,
				operation.id,
				async () => ({
					model: bot.model,
					provider: bot.provider as "ollama" | "apple",
					originator: "orbit-nest",
				}),
			);
			try {
				const member = await this.projects.requireActive(session.getId());
				if (!member || member.projectId !== operation.projectId)
					throw new Error("Session reservation membership conflict");
				if (!data.sessions.some((s) => s.sessionId === session.getId()))
					data.sessions.push({
						botId: operation.botId,
						projectId: projectId,
						sessionId: session.getId(),
						membershipRevision: member.revision,
						name: operation.name,
					});
			} finally {
				await session.close();
			}
			await this.repository.rename(operation.id, {
				title: operation.name,
				expectedRevision: 0,
				operationId: messageId(operation.id, "session-title"),
			});
			await this.checkpoint?.("session-created", operation.id);
		}
		const savedOperation = data.operations.find((op) => op.id === operation.id);
		if (!savedOperation)
			throw new Error("Context operation evidence is missing");
		savedOperation.done = true;
		this.save(data);
	}
	private async resumeOperations(): Promise<void> {
		// A later Session intent may depend on the preceding Project intent.
		for (const operation of this.data().operations)
			if (!operation.done) await this.apply(operation);
	}
	select(botId: string, sessionId: string): Promise<void> {
		return this.serial(async () => {
			this.host.bot(botId);
			const data = this.data();
			if (sessionId) {
				const target = data.sessions.find(
					(s) => s.botId === botId && s.sessionId === sessionId,
				);
				if (!target) throw new Error("Session is not associated with this Bot");
				await this.validate(target);
			}
			data.selected = data.selected.filter((s) => s.botId !== botId);
			if (sessionId) data.selected.push({ botId, sessionId });
			this.save(data);
		});
	}
	private async validate(target: ContextTarget): Promise<void> {
		this.checkTarget(target);
		const data = this.data();
		if (
			!data.projects.some(
				(p) => p.botId === target.botId && p.projectId === target.projectId,
			) ||
			!data.sessions.some(
				(s) =>
					s.botId === target.botId &&
					s.projectId === target.projectId &&
					s.sessionId === target.sessionId &&
					s.membershipRevision === target.membershipRevision,
			)
		)
			throw new Error("Context target is not associated with this Bot");
		const member = await this.projects.requireActive(target.sessionId);
		if (
			member?.projectId !== target.projectId ||
			member.revision !== target.membershipRevision ||
			this.repository.isArchived(target.sessionId)
		)
			throw new Error(
				"Context membership changed or is unavailable; start a new conversation",
			);
	}
	validateNotice(target: ContextTarget): Promise<void> {
		return this.serial(() => this.validate(target));
	}
	addMemory(
		botId: string,
		body: string,
		operationId: string,
		expectedSessionId?: string,
		guard?: NoteGuard,
	): Promise<void> {
		const captured = this.selection(botId);
		return this.serial(async () => {
			uuid(operationId);
			this.noteBody(body);
			const target = captured;
			if (
				expectedSessionId !== undefined &&
				target?.sessionId !== expectedSessionId
			)
				throw new Error(
					"Project note target changed; review the selected conversation",
				);
			if (!target)
				throw new Error("Select a Project conversation before adding a note");
			if (guard) this.selectedNoteTarget(botId, guard.target);
			await this.validate(target);
			if (guard) {
				if (!Number.isSafeInteger(guard.generation) || guard.generation < 0)
					throw new Error("Invalid Project note generation");
				const prior = await this.catalog.query({
					kind: "operation",
					id: operationId,
				});
				if (!prior && (await this.noteGeneration(target)) !== guard.generation)
					throw new Error("Project notes changed; reload before saving");
			}
			await this.memory.create(target.projectId, {
				body,
				title: "User-authored Project note",
				operationId,
			});
		});
	}
	private verifyHistory(session: Session, target: ContextTarget): void {
		const state = this.host.store.snapshot(),
			receipts = this.data().projected;
		for (const run of state.runs) {
			const task = run.payload as { context?: ContextTarget; prompt?: string };
			if (
				run.status !== "succeeded" ||
				capturedContext(run.payload)?.sessionId !== target.sessionId
			)
				continue;
			const receipt = receipts.find((entry) => entry.runId === run.id);
			const attempt = state.attempts
				.slice()
				.reverse()
				.find(
					(entry) => entry.runId === run.id && entry.status === "succeeded",
				);
			if (
				!receipt ||
				!attempt ||
				typeof task.prompt !== "string" ||
				typeof run.result !== "string"
			)
				throw new Error(
					"Project transcript projection is incomplete; inspect the saved result",
				);
			if (this.managedProjection(session, run.id, task.prompt, run.result))
				continue;
			for (const [role, content] of [
				["user", task.prompt],
				["assistant", run.result],
			] as const) {
				const existing = session
					.getMessages()
					.find((message) => message.id === messageId(run.id, role));
				const payload = {
					nestRunId: run.id,
					nestAttemptId: attempt.id,
					digest: receipt.digest,
				};
				if (
					existing?.type !== role ||
					existing.content !== content ||
					digest(existing.payload) !== digest(payload)
				)
					throw new Error(
						"An applied Project result is missing or changed in its transcript; offline inspection is required",
					);
			}
		}
	}
	async begin(
		target: ContextTarget,
		runId: string,
		managed = false,
	): Promise<ContextLease> {
		await this.validate(target);
		if (this.active.has(target.sessionId))
			throw new Error("Session already has an active writer");
		const snapshot: ProjectContextSnapshot | undefined = managed
			? undefined
			: await this.memory.prepare(target.sessionId, runId, { mode: "curated" });
		const generation =
			snapshot?.generation ?? (await this.noteGeneration(target));
		const source = await this.repository.findById(target.sessionId);
		if (!source) throw new Error("Project Session transcript is missing");
		const session = this.repository.open(source.file);
		this.active.set(target.sessionId, session);
		try {
			await this.validate(target);
			this.verifyHistory(session, target);
			if (snapshot)
				this.host.store.setData("contextEvidence", {
					...(this.host.store.snapshot().data.contextEvidence as object),
					[runId]: snapshot,
				});
			const validate = async () => {
				await this.validate(target);
				const project = await this.catalog.query({
					kind: "project",
					id: target.projectId,
				});
				if (project?.memoryGeneration !== generation)
					throw new Error(
						"Project memory changed during execution; result was not committed",
					);
			};
			return {
				...(managed
					? {
							chat: (
								model: Model,
								system: string,
								prompt: string,
								signal: AbortSignal,
							) =>
								this.managedChat(
									session,
									target,
									runId,
									model,
									system,
									prompt,
									signal,
								),
						}
					: {}),
				history: session
					.getMessages()
					.filter((m) => m.role === "user" || m.role === "assistant")
					.slice(-8)
					.map((m) => ({
						role: m.role as "user" | "assistant",
						content: m.content.slice(0, m.role === "user" ? 2000 : 4000),
					})),
				memory: snapshot?.rendered ?? "",
				validate,
				commit: (action) =>
					this.serial(async () => {
						await validate();
						action();
					}),
				close: async () => {
					await session.close();
					this.active.delete(target.sessionId);
				},
			};
		} catch (error) {
			await session.close();
			this.active.delete(target.sessionId);
			throw error;
		}
	}
	private managedProjection(
		session: Session,
		runId: string,
		prompt: string,
		result: string,
	): boolean {
		const entries = session.getEntries();
		const input = entries.find(
			(entry) =>
				entry.type === "message" &&
				entry.message.id === messageId(runId, "user"),
		);
		if (
			input?.type !== "message" ||
			(input.message.payload as { nestManagedRunId?: unknown } | undefined)
				?.nestManagedRunId !== runId
		)
			return false;
		const messages = session.getMessages();
		const answer = entries.findLast(
			(entry) =>
				entry.type === "message" &&
				entry.turnId === input.turnId &&
				entry.message.role === "assistant",
		);
		if (
			!input.turnId ||
			input.message.contents.join("") !== prompt ||
			!entries.some(
				(entry) =>
					entry.type === "turn_event" &&
					entry.turnId === input.turnId &&
					entry.phase === "completed",
			) ||
			answer?.type !== "message" ||
			messages.find((message) => message.id === answer.message.id)?.content !==
				result
		)
			throw new Error(
				"Managed Project result differs from its completed Core turn; inspection required",
			);
		return true;
	}
	private committedModelContext(session: Session, runId: string) {
		const entries = session.getEntries(),
			state = this.host.store.snapshot();
		const succeeded = new Set(
			state.runs
				.filter((run) => run.status === "succeeded")
				.map((run) => run.id),
		);
		const committed = new Set(
			this.data()
				.projected.filter((receipt) => succeeded.has(receipt.runId))
				.map((receipt) => receipt.runId),
		);
		const excludedTurns = new Set(
			entries.flatMap((entry) => {
				if (entry.type !== "message" || !entry.turnId) return [];
				const id = (
					entry.message.payload as { nestManagedRunId?: unknown } | undefined
				)?.nestManagedRunId;
				if (typeof id !== "string" || id === runId || committed.has(id))
					return [];
				return [entry.turnId];
			}),
		);
		// Retain Core's canonical tool-call/result objects and whole-turn ordering.
		// Interrupted/uncommitted turns remain on disk, outside subsequent model input.
		const context = new SessionContextBuilder().build(session);
		const turns = new Map(
			entries
				.filter((entry) => entry.type === "message")
				.map((entry) => [entry.message.id, entry.turnId]),
		);
		const groups: { id: string; messages: Message[] }[] = [];
		let legacy = "legacy-root";
		for (const message of context.messages) {
			const turn = turns.get(message.id);
			if (turn && excludedTurns.has(turn)) continue;
			if (message.role === "user") legacy = message.id;
			const id = turns.get(message.id) ?? legacy;
			let group = groups.at(-1);
			if (group?.id !== id) {
				group = { id, messages: [] };
				groups.push(group);
			}
			group.messages.push(message);
		}
		// Keep the prior four exchanges plus the current turn, including complete tool groups.
		return { messages: groups.slice(-5).flatMap((group) => group.messages) };
	}
	private async managedChat(
		session: Session,
		target: ContextTarget,
		runId: string,
		model: Model,
		system: string,
		prompt: string,
		signal: AbortSignal,
	): Promise<string> {
		await this.validate(target);
		const selected = { ...this.host.bot(target.botId) };
		if (
			selected.provider !== "ollama" ||
			model.getProvider() !== "ollama" ||
			model.getModel() !== selected.model
		)
			throw new Error(
				"Managed Project chat requires the explicitly selected Ollama model",
			);
		let live = true;
		// Core fixes scope from the leased Session and rechecks canonical membership.
		// This callback only narrows that scope using revocable, trusted Nest state.
		const memorySearch = (
			scope: Readonly<{ projectId: string; sessionId: string }>,
		) => {
			if (
				!live ||
				this.closing ||
				signal.aborted ||
				scope.projectId !== target.projectId ||
				scope.sessionId !== target.sessionId
			)
				return false;
			const bot = this.host.bot(target.botId),
				data = this.data();
			return (
				bot.provider === selected.provider &&
				bot.model === selected.model &&
				bot.profileRevision === selected.profileRevision &&
				this.host.canSearchProjectMemory?.(target.botId) === true &&
				data.projects.some(
					(entry) =>
						entry.botId === target.botId && entry.projectId === scope.projectId,
				) &&
				data.sessions.some(
					(entry) =>
						entry.botId === target.botId &&
						entry.projectId === scope.projectId &&
						entry.sessionId === scope.sessionId &&
						entry.membershipRevision === target.membershipRevision,
				)
			);
		};
		const logs = new MemorySessionLogStore();
		const agent = new Agent({
			cwd: this.repository.rootDir,
			state: new State(session),
			projectMemory: this.memory,
			logStore: logs,
			model: { provider: "ollama", name: selected.model },
			toolProfile: "none",
			settings: { tools: { profile: "none", include: [], exclude: [] } },
			contextPolicy: { mode: "disabled" },
			interruptionPolicy: { mode: "disabled" },
			messages: [new Message("session", { content: system })],
			deps: {
				createModel: () => model,
				sessionContextBuilder: {
					build: (current) => this.committedModelContext(current, runId),
				},
				// Ignore inherited workspace MCP configuration; Nest exposes no generic tools.
				createMcpToolManager: (_settings, options) =>
					createMcpToolManager({ servers: {} }, options),
			},
			execution: {
				limits: {
					modelCalls: 4,
					toolRequests: 3,
					toolRounds: 3,
					elapsedMs: 180000,
				},
				policy: {
					generation: "nest-project-memory-v1",
					profile: "workspace-confirm",
					roots: [],
					revoked: () => !memorySearch(target),
					decide: (operation) =>
						operation.name === "project_memory_search" &&
						operation.effect === "read" &&
						operation.binding.projectId === target.projectId &&
						operation.binding.sessionId === target.sessionId
							? "allow"
							: "deny",
				},
			},
		});
		try {
			const handle = await agent.startRun(
				[
					new Message("user", {
						id: messageId(runId, "user"),
						content: prompt,
						payload: { nestManagedRunId: runId },
					}),
				],
				{
					requestId: messageId(runId, "core-run"),
					memorySearch,
					signal,
					maxOutputTokens: 1200,
				},
			);
			const result = await handle.finished;
			if (
				result.outcome !== "completed" ||
				!result.quiescence ||
				result.recording.status !== "acknowledged"
			)
				throw new Error(
					`Managed Project chat did not complete: ${result.outcome} (${result.reason})`,
				);
			await this.validate(target);
			const answer = handle.value()?.content;
			if (!answer?.trim())
				throw new Error("Managed Project chat returned no answer");
			return answer;
		} finally {
			live = false;
			await agent.close();
			await logs.close();
		}
	}

	private projectionIdentity(
		run: ScheduledRun,
		target: ContextTarget,
		prompt: unknown,
	): ResultProjection {
		if (typeof prompt !== "string" || typeof run.result !== "string")
			throw new Error("Invalid context result correlation");
		const attempt = this.host.store
			.snapshot()
			.attempts.reverse()
			.find((value) => value.runId === run.id && value.status === "succeeded");
		if (!attempt)
			throw new Error("Saved Project result lacks a successful attempt");
		const fingerprint = digest([
			run.id,
			attempt.id,
			target,
			prompt,
			run.result,
		]);
		return {
			runId: run.id,
			attemptId: attempt.id,
			target,
			prompt,
			result: run.result,
			fingerprint,
		};
	}
	private async appendProjection(
		session: Session,
		projection: ResultProjection,
	): Promise<void> {
		// Parent order and the crash checkpoint require user-before-assistant writes.
		for (const [role, content] of [
			["user", projection.prompt],
			["assistant", projection.result],
		] as const) {
			this.appendProjectedMessage(session, projection, role, content);
			if (role === "user" && this.checkpoint) {
				await session.synchronize(
					process.platform === "win32"
						? "file-sync"
						: "file-and-directory-sync",
				);
				await this.checkpoint("user-message-saved", projection.runId);
			}
		}
	}
	private appendProjectedMessage(
		session: Session,
		projection: ResultProjection,
		role: "user" | "assistant",
		content: string,
	): void {
		const id = messageId(projection.runId, role),
			payload = {
				nestRunId: projection.runId,
				nestAttemptId: projection.attemptId,
				digest: projection.fingerprint,
			};
		const existing = session.getMessages().find((m) => m.id === id);
		if (existing) {
			if (
				existing.type !== role ||
				existing.content !== content ||
				digest(existing.payload) !== digest(payload)
			)
				throw new Error(
					"Existing transcript result conflicts; inspection required",
				);
		} else
			session.appendMessages([new Message(role, { id, content, payload })]);
	}

	async project(run: ScheduledRun): Promise<void> {
		if (run.status !== "succeeded") return;
		const task = run.payload as { context?: ContextTarget; prompt?: string };
		const target = capturedContext(run.payload);
		if (!target) return;
		const projection = this.projectionIdentity(run, target, task.prompt);
		const { fingerprint } = projection;
		const prior = this.data().projected.find((p) => p.runId === run.id);
		if (prior) {
			if (prior.digest !== fingerprint)
				throw new Error("Context result receipt conflicts");
			return;
		}
		await this.checkpoint?.("result-saved", run.id);
		await this.validate(target);
		const found = await this.repository.findById(target.sessionId);
		if (!found) throw new Error("Result Session is missing");
		const owned = this.active.get(target.sessionId),
			session = owned ?? this.repository.open(found.file);
		try {
			await this.validate(target);
			if (
				!this.managedProjection(
					session,
					run.id,
					projection.prompt,
					projection.result,
				)
			)
				await this.appendProjection(session, projection);
			else await this.checkpoint?.("user-message-saved", run.id);
			await session.synchronize(
				process.platform === "win32" ? "file-sync" : "file-and-directory-sync",
			);
			await this.checkpoint?.("transcript-saved", run.id);
			await this.serial(async () => {
				const data = this.data();
				data.projected.push({ runId: run.id, digest: fingerprint });
				this.save(data);
			});
		} finally {
			if (!owned) await session.close();
		}
	}
	async reconcile(): Promise<void> {
		await this.serial(() => this.resumeOperations());
		// Reconcile in ledger order so each Session retains transcript parent order.
		for (const run of this.host.store.snapshot().runs) await this.project(run);
	}
	async close(): Promise<void> {
		this.closing = true;
		await this.queue;
		// The owning Runtime stops execution before shutdown. Retain objects until
		// each close succeeds so cleanup can be retried after an I/O failure.
		for (const [id, session] of this.active) {
			await session.close();
			this.active.delete(id);
		}
		await this.memory.close();
		await this.catalog.close();
	}
}
export const openContext = ProjectContext.open;
