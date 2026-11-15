import { createHash } from "node:crypto";
import { canonicalJSON } from "@cybergarage/orbit/dist/core/execution/canonical-json.js";
import { EventStore } from "@cybergarage/orbit/dist/core/execution/event-store.js";
import type {
	DurableWorkStore,
	ScheduledRun,
} from "@cybergarage/orbit/dist/core/execution/scheduled-work.js";

const CONSUMER = "nest-local-approval";
export const approvalDigest = (value: unknown): string =>
	createHash("sha256").update(canonicalJSON(value)).digest("hex");
export const approvalAction = (run: ScheduledRun): string =>
	approvalDigest([
		run.id,
		run.requestId,
		run.payload,
		run.effect,
		run.approval?.preview ?? null,
	]);
export interface ApprovalRequest {
	id: string;
	botId: string;
	sessionId: string;
	token: string;
}
interface Answer extends ApprovalRequest {
	allow: boolean;
	action: string;
}
export type ApprovalCheckpoint =
	| "accepted"
	| "admitted"
	| "decided"
	| "consumed";
/** Local UI facts only. Admission never dispatches work or performs effects. */
export class ApprovalAnswers {
	private readonly events: EventStore;
	constructor(
		file: string,
		private readonly checkpoint?: (stage: ApprovalCheckpoint) => void,
	) {
		this.events = new EventStore(file);
	}
	private facts(): Answer[] {
		const state = this.events.snapshot();
		const consumed = state.data.consumed ?? {};
		if (
			!consumed ||
			typeof consumed !== "object" ||
			Array.isArray(consumed) ||
			Object.entries(consumed).some(
				([id, value]) =>
					typeof value !== "string" ||
					!["decided", "stale", "cancelled"].includes(value) ||
					!state.deliveries.some(
						(d) =>
							d.eventId === id &&
							d.consumer === CONSUMER &&
							d.status === "acknowledged" &&
							d.jobId === id,
					),
			) ||
			state.deliveries.some(
				(d) =>
					d.consumer !== CONSUMER ||
					d.status === "cancelled" ||
					(d.status === "acknowledged" && d.jobId !== d.eventId),
			)
		)
			throw new Error(
				"Corrupt approval consumption correlation; inspection required",
			);
		return state.events.map((event) => {
			const answer = event.payload as Answer;
			if (
				!answer ||
				typeof answer.id !== "string" ||
				typeof answer.botId !== "string" ||
				answer.sessionId !== "" ||
				typeof answer.allow !== "boolean" ||
				!/^[a-f0-9]{64}$/.test(answer.token) ||
				!/^[a-f0-9]{64}$/.test(answer.action) ||
				event.id !== `answer:${answer.id}` ||
				event.key !== `legacy:${answer.botId}` ||
				event.source !== "nest-local-ui" ||
				event.type !== "approval-answer" ||
				state.deliveries.filter(
					(d) => d.eventId === event.id && d.consumer === CONSUMER,
				).length !== 1
			)
				throw new Error(
					"Corrupt approval answer correlation; inspection required",
				);
			return answer;
		});
	}
	accept(
		input: ApprovalRequest & { allow: boolean },
		work: DurableWorkStore,
		validate: (request: ApprovalRequest) => void,
	): void {
		const prior = this.facts().find((answer) => answer.id === input.id);
		if (prior) {
			if (
				canonicalJSON({ ...input, action: prior.action }) !==
				canonicalJSON(prior)
			)
				throw new Error("Conflicting approval answer");
			return;
		}
		validate(input);
		const run = work.snapshot().runs.find((run) => run.id === input.id);
		if (run?.status !== "approval") throw new Error("No pending approval");
		const answer: Answer = { ...input, action: approvalAction(run) };
		this.events.accept(
			{
				id: `answer:${input.id}`,
				key: `legacy:${input.botId}`,
				source: "nest-local-ui",
				type: "approval-answer",
				payload: answer,
			},
			CONSUMER,
		);
		this.checkpoint?.("accepted");
	}
	reconcile(
		work: DurableWorkStore,
		validate: (request: ApprovalRequest) => void,
	): void {
		const facts = this.facts();
		const snapshot = this.events.snapshot();
		if (
			snapshot.deliveries.some(
				(d) => d.consumer === CONSUMER && d.status === "pending",
			)
		) {
			this.events.admit(CONSUMER, (event) => event.id);
			this.checkpoint?.("admitted");
		}
		for (const answer of facts) this.consume(answer, work, validate);
		for (const run of work.snapshot().runs) {
			const payload = run.payload as { approvalAnswerVersion?: number } | null;
			if (
				payload?.approvalAnswerVersion === 1 &&
				run.approval?.decision &&
				!facts.some(
					(answer) =>
						answer.id === run.id &&
						answer.allow === (run.approval?.decision === "allow"),
				)
			)
				throw new Error(
					"Saved approval answer is missing; inspection required",
				);
		}
	}
	private consume(
		answer: Answer,
		work: DurableWorkStore,
		validate: (request: ApprovalRequest) => void,
	): void {
		const eventId = `answer:${answer.id}`;
		const consumed = (this.events.snapshot().data.consumed ?? {}) as Record<
			string,
			string
		>;
		const run = work.snapshot().runs.find((run) => run.id === answer.id);
		if (
			!run ||
			approvalAction(run) !== answer.action ||
			(run.payload as { botId?: string }).botId !== answer.botId
		)
			throw new Error("Approval action changed; inspection required");
		if (
			consumed[eventId] === "decided" &&
			run.approval?.decision !== (answer.allow ? "allow" : "deny")
		)
			throw new Error(
				"Consumed approval decision conflicts; inspection required",
			);
		if (consumed[eventId]) return;
		const outcome = this.applyDecision(answer, run, work, validate);
		this.events.transact((state) => {
			state.data.consumed = {
				...((state.data.consumed ?? {}) as object),
				[eventId]: outcome,
			};
		});
		this.checkpoint?.("consumed");
	}
	private applyDecision(
		answer: Answer,
		run: ScheduledRun,
		work: DurableWorkStore,
		validate: (request: ApprovalRequest) => void,
	): string {
		if (run.status !== "approval") {
			if (run.approval?.decision === (answer.allow ? "allow" : "deny"))
				return "decided";
			// Cancellation wins. A saved fact cannot revive a stopped request.
			if (run.status === "cancelled") return "cancelled";
			throw new Error("Approval decision conflicts; inspection required");
		}
		try {
			validate(answer);
		} catch {
			return "stale";
		}
		work.approve(answer.id, answer.allow);
		this.checkpoint?.("decided");
		return "decided";
	}

	authorized(run: ScheduledRun): boolean {
		const answer = this.facts().find((answer) => answer.id === run.id);
		const consumed = this.events.snapshot().data.consumed as
			| Record<string, string>
			| undefined;
		return (
			!!answer &&
			answer.allow &&
			answer.action === approvalAction(run) &&
			consumed?.[`answer:${run.id}`] === "decided"
		);
	}
	close(): void {
		this.events.close();
	}
}
