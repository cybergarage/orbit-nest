import { canonicalJSON } from "@cybergarage/orbit/dist/core/execution/canonical-json.js";
import {
	EventStore,
	type EventStoreState,
} from "@cybergarage/orbit/dist/core/execution/event-store.js";
import type {
	DurableWorkStore,
	ScheduledRun,
} from "@cybergarage/orbit/dist/core/execution/scheduled-work.js";
import { capturedContext } from "./context-target";

const CONSUMER = "nest-local-conversation";
export interface LocalMessage {
	id: string;
	botId: string;
	sessionId: string;
	prompt: string;
}
interface MessageFact extends LocalMessage {
	task: unknown;
}
interface Admission {
	occurrenceId: string;
	coreRequestId?: string;
	runId?: string;
	stopped?: boolean;
}
export interface MessageReceipt extends LocalMessage {
	status:
		| "accepted"
		| "waiting"
		| "running"
		| "result-saved"
		| "failed"
		| "cancelled"
		| "interrupted"
		| "unknown";
	runId?: string;
	task: unknown;
}
export type MessageCheckpoint = "accepted" | "admitted" | "enqueued" | "bound";
const eventId = (id: string) => `message:${id}`;
const targetKey = (message: LocalMessage) =>
	message.sessionId || `legacy:${message.botId}`;
export function capturedMessageId(payload: unknown): string | undefined {
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
	const task = payload as {
		nestInputVersion?: unknown;
		nestMessageId?: unknown;
	};
	if (task.nestInputVersion === undefined) return;
	if (
		task.nestInputVersion !== 1 ||
		typeof task.nestMessageId !== "string" ||
		!/^[a-zA-Z0-9-]{1,150}$/.test(task.nestMessageId)
	)
		throw new Error(
			"Unsupported or corrupt local input marker; inspection required",
		);
	return task.nestMessageId;
}
function admissions(state: EventStoreState): Record<string, Admission> {
	const entries = state.data.admissions ?? {};
	if (!entries || typeof entries !== "object" || Array.isArray(entries))
		throw new Error("Corrupt message admissions; inspection required");
	const values = entries as Record<string, Admission>;
	for (const [id, value] of Object.entries(values)) {
		if (
			value?.occurrenceId !== id ||
			(value.runId !== undefined) !== (value.coreRequestId !== undefined) ||
			(value.coreRequestId !== undefined &&
				typeof value.coreRequestId !== "string") ||
			(value.runId !== undefined && typeof value.runId !== "string") ||
			(value.stopped !== undefined && typeof value.stopped !== "boolean") ||
			!state.deliveries.some(
				(d) =>
					d.eventId === id &&
					d.consumer === CONSUMER &&
					d.status === "acknowledged" &&
					d.jobId === id,
			)
		)
			throw new Error(
				"Corrupt message admission correlation; inspection required",
			);
	}
	for (const delivery of state.deliveries) {
		if (
			delivery.consumer !== CONSUMER ||
			(delivery.status === "acknowledged" &&
				(!values[delivery.eventId] || delivery.jobId !== delivery.eventId))
		)
			throw new Error(
				"Corrupt message delivery correlation; inspection required",
			);
	}
	return values;
}
/** Immutable local inputs and receipt admission only; all execution stays in core work. */
export class ConversationInput {
	private readonly events: EventStore;
	constructor(
		file: string,
		private readonly checkpoint?: (stage: MessageCheckpoint) => void,
	) {
		this.events = new EventStore(file);
	}
	private facts(): MessageFact[] {
		const state = this.events.snapshot();
		admissions(state);
		return state.events.map((event) => {
			const fact = event.payload as MessageFact;
			const task = fact?.task as
				| {
						botId?: string;
						prompt?: string;
						kind?: string;
						nestMessageId?: string;
				  }
				| undefined;
			const target = capturedContext(task);
			if (
				!fact ||
				typeof fact.id !== "string" ||
				!/^[a-zA-Z0-9-]{1,150}$/.test(fact.id) ||
				typeof fact.botId !== "string" ||
				typeof fact.sessionId !== "string" ||
				typeof fact.prompt !== "string" ||
				!fact.prompt.trim() ||
				fact.prompt.length > 4000 ||
				task?.kind !== "chat" ||
				task.botId !== fact.botId ||
				task.prompt !== fact.prompt ||
				capturedMessageId(task) !== fact.id ||
				(target?.sessionId ?? "") !== fact.sessionId ||
				(target && target.botId !== fact.botId) ||
				event.id !== eventId(fact.id) ||
				event.key !== targetKey(fact) ||
				event.source !== "nest-local-ui" ||
				event.type !== "conversation-input" ||
				state.deliveries.filter(
					(d) => d.eventId === event.id && d.consumer === CONSUMER,
				).length !== 1
			)
				throw new Error(
					"Corrupt local message correlation; inspection required",
				);
			return fact;
		});
	}
	existing(input: LocalMessage): boolean {
		const prior = this.facts().find((fact) => fact.id === input.id);
		if (!prior) return false;
		const { task: _task, ...original } = prior;
		if (canonicalJSON(original) !== canonicalJSON(input))
			throw new Error("Conflicting local message ID");
		return true;
	}
	accept(input: LocalMessage, task: unknown): void {
		if (this.existing(input)) return;
		const fact: MessageFact = { ...input, task };
		this.events.accept(
			{
				id: eventId(input.id),
				key: targetKey(input),
				source: "nest-local-ui",
				type: "conversation-input",
				payload: fact,
			},
			CONSUMER,
		);
		this.checkpoint?.("accepted");
	}
	private run(
		fact: MessageFact,
		work: DurableWorkStore,
	): ScheduledRun | undefined {
		const id = eventId(fact.id);
		const admission = admissions(this.events.snapshot())[id];
		const run = work.snapshot().runs.find((run) => run.occurrenceId === id);
		if (
			(admission?.runId && run?.id !== admission.runId) ||
			(run &&
				(run.id !== id ||
					(admission?.coreRequestId !== undefined &&
						run.requestId !== admission.coreRequestId) ||
					run.effect !== "read" ||
					run.approval ||
					canonicalJSON(run.payload) !== canonicalJSON(fact.task)))
		)
			throw new Error(
				"Saved message work changed or is missing; inspection required",
			);
		return run;
	}
	reconcile(work: DurableWorkStore): void {
		const facts = this.facts();
		if (this.events.snapshot().deliveries.some((d) => d.status === "pending")) {
			this.events.admit(CONSUMER, (event, state) => {
				state.data.admissions = {
					...admissions(state),
					[event.id]: { occurrenceId: event.id },
				};
				return event.id;
			});
			this.checkpoint?.("admitted");
		}
		for (const fact of facts) this.bind(fact, work);
		for (const run of work.snapshot().runs) {
			const marker = capturedMessageId(run.payload);
			if (
				marker !== undefined &&
				!facts.some(
					(fact) => fact.id === marker && eventId(fact.id) === run.occurrenceId,
				)
			)
				throw new Error("Saved local input is missing; inspection required");
		}
	}
	private bind(fact: MessageFact, work: DurableWorkStore): void {
		const id = eventId(fact.id),
			state = this.events.snapshot();
		const admission = admissions(state)[id];
		let run = this.run(fact, work);
		if (
			state.deliveries.find((d) => d.eventId === id)?.status === "cancelled"
		) {
			if (run)
				throw new Error(
					"Cancelled message has unexpected work; inspection required",
				);
			return;
		}
		if (!admission)
			throw new Error("Message admission is missing; inspection required");
		if (admission.stopped) {
			if (run && ["queued", "running", "approval"].includes(run.status))
				work.cancel(run.id);
			return;
		}
		if (!run) {
			work.enqueue(id, fact.task);
			this.checkpoint?.("enqueued");
			run = this.run(fact, work);
		}
		if (!run)
			throw new Error("Message work is unavailable; inspection required");
		if (!admission.runId) {
			const runId = run.id,
				coreRequestId = run.requestId;
			this.events.transact((state) => {
				const entry = admissions(state)[id];
				entry.runId = runId;
				entry.coreRequestId = coreRequestId;
			});
			this.checkpoint?.("bound");
		}
		// Core requeues interrupted read work. This adapter requires a new explicit
		// message ID instead of repeating a possibly completed local inference.
		if (
			run.status === "queued" &&
			work
				.snapshot()
				.attempts.some(
					(attempt) => attempt.runId === run.id && attempt.status === "unknown",
				)
		)
			work.cancel(run.id);
	}
	list(work: DurableWorkStore): MessageReceipt[] {
		const state = this.events.snapshot();
		return this.facts().map((fact) => {
			const run = this.run(fact, work);
			const admission = admissions(state)[eventId(fact.id)];
			const delivery = state.deliveries.find(
				(d) => d.eventId === eventId(fact.id),
			);
			let status: MessageReceipt["status"] = "accepted";
			if (run) {
				if (run.status === "approval")
					throw new Error("Unexpected message approval; inspection required");
				if (run.status === "queued") status = "waiting";
				else status = run.status === "succeeded" ? "result-saved" : run.status;
				if (
					run.status === "cancelled" &&
					work
						.snapshot()
						.attempts.some((a) => a.runId === run.id && a.status === "unknown")
				)
					status = "interrupted";
			} else if (admission?.stopped || delivery?.status === "cancelled")
				status = "cancelled";
			else if (admission) status = "waiting";
			return { ...fact, status, ...(run ? { runId: run.id } : {}) };
		});
	}
	stop(botId: string, work: DurableWorkStore, messageId?: string): void {
		const facts = this.facts().filter(
			(fact) =>
				fact.botId === botId &&
				(messageId === undefined || fact.id === messageId),
		);
		if (messageId !== undefined && !facts.length)
			throw new Error("Unknown local message");
		this.events.transact((state) => {
			for (const fact of facts) {
				const id = eventId(fact.id),
					delivery = state.deliveries.find((d) => d.eventId === id);
				if (delivery?.status === "pending") delivery.status = "cancelled";
				const admission = admissions(state)[id];
				if (admission) admission.stopped = true;
			}
		});
		for (const fact of facts) {
			const run = this.run(fact, work);
			if (run) work.cancel(run.id);
		}
	}
	close(): void {
		this.events.close();
	}
}
