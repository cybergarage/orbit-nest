import { createHash } from "node:crypto";
import {
	EventStore,
	type EventStoreState,
} from "@cybergarage/orbit/dist/core/execution/event-store.js";
import { canonicalJSON } from "@cybergarage/orbit/dist/core/execution/canonical-json.js";
import type { WorkState } from "@cybergarage/orbit/dist/core/execution/scheduled-work.js";
import { capturedContext, type ContextTarget } from "./context-target";

const CONSUMER = "nest-local-result-inbox";
interface ResultFact {
	runId: string;
	attemptId: string;
	botId: string;
	target: ContextTarget | null;
	digest: string;
}
export interface ResultNotice extends ResultFact {
	id: string;
	delivery: "pending" | "delivered";
	read: boolean;
}
interface Receipt {
	deliveredAt: number;
	readAt?: number;
}
const digest = (value: unknown) =>
	createHash("sha256").update(canonicalJSON(value)).digest("hex");
function receipts(state: EventStoreState): Record<string, Receipt> {
	const raw = state.data.receipts ?? {};
	if (!raw || typeof raw !== "object" || Array.isArray(raw))
		throw new Error("Corrupt notification receipts");
	const values = raw as Record<string, Receipt>;
	for (const [id, receipt] of Object.entries(values)) {
		if (
			!receipt ||
			!Number.isSafeInteger(receipt.deliveredAt) ||
			receipt.deliveredAt < 0 ||
			(receipt.readAt !== undefined &&
				(!Number.isSafeInteger(receipt.readAt) || receipt.readAt < 0)) ||
			!state.deliveries.some(
				(d) =>
					d.eventId === id &&
					d.consumer === CONSUMER &&
					d.status === "acknowledged" &&
					d.jobId === id,
			)
		)
			throw new Error("Corrupt notification receipt correlation");
	}
	for (const delivery of state.deliveries) {
		if (
			delivery.consumer !== CONSUMER ||
			delivery.status === "cancelled" ||
			(delivery.status === "acknowledged" && !values[delivery.eventId])
		)
			throw new Error("Corrupt notification delivery correlation");
	}
	return values;
}
function fact(state: WorkState, runId: string): ResultFact | undefined {
	const run = state.runs.find((r) => r.id === runId);
	const payload = run?.payload as
		| { botId?: unknown; kind?: string }
		| undefined;
	if (
		run?.status !== "succeeded" ||
		typeof run.result !== "string" ||
		!run.result ||
		!payload ||
		typeof payload.botId !== "string" ||
		payload.kind === "memory"
	)
		return;
	const attempts = state.attempts.filter((a) => a.runId === run.id);
	const attempt = attempts.at(-1);
	if (attempt?.status !== "succeeded" || attempt.ended === undefined)
		throw new Error("Saved result has no final successful attempt");
	const target = capturedContext(run.payload) ?? null;
	if (target && target.botId !== payload.botId)
		throw new Error("Result Bot correlation conflicts");
	return {
		runId,
		attemptId: attempt.id,
		botId: payload.botId,
		target,
		digest: digest([run.id, attempt.id, run.payload, run.result]),
	};
}
/** Admits local receipt records only. No executable work, model or transcript effects. */
export class ResultNotifications {
	private readonly events: EventStore;
	constructor(
		file: string,
		private readonly checkpoint?: (stage: "accepted" | "delivered") => void,
	) {
		this.events = new EventStore(file);
	}
	reconcile(work: WorkState): void {
		const existing = this.events.snapshot();
		receipts(existing);
		for (const run of work.runs) {
			const payload = fact(work, run.id);
			if (!payload) continue;
			const prior = existing.events.find((e) => e.id === `result:${run.id}`);
			if (prior) {
				if (canonicalJSON(prior.payload) !== canonicalJSON(payload))
					throw new Error("Conflicting event ID");
				continue;
			}
			this.events.accept(
				{
					id: `result:${run.id}`,
					key: payload.target?.sessionId ?? `legacy:${payload.botId}`,
					source: "nest-persisted-work",
					type: "result-saved",
					payload,
				},
				CONSUMER,
			);
			this.checkpoint?.("accepted");
		}
		if (
			!this.events
				.snapshot()
				.deliveries.some(
					(d) => d.consumer === CONSUMER && d.status === "pending",
				)
		)
			return;
		this.events.admit(CONSUMER, (event, state) => {
			const saved = fact(work, (event.payload as ResultFact).runId);
			if (!saved || canonicalJSON(saved) !== canonicalJSON(event.payload))
				throw new Error("Notification source changed; inspection required");
			state.data.receipts = {
				...receipts(state),
				[event.id]: { deliveredAt: Date.now() },
			};
			return event.id;
		});
		this.checkpoint?.("delivered");
	}
	list(work: WorkState): ResultNotice[] {
		const state = this.events.snapshot();
		const delivered = receipts(state);
		return state.events.map((event) => {
			const payload = event.payload as ResultFact;
			const saved = fact(work, payload.runId);
			if (
				!saved ||
				event.id !== `result:${saved.runId}` ||
				event.source !== "nest-persisted-work" ||
				event.type !== "result-saved" ||
				event.key !== (saved.target?.sessionId ?? `legacy:${saved.botId}`) ||
				canonicalJSON(saved) !== canonicalJSON(payload)
			)
				throw new Error("Notification source changed; inspection required");
			const receipt = delivered[event.id];
			return {
				...saved,
				id: event.id,
				delivery: receipt ? "delivered" : "pending",
				read: receipt?.readAt !== undefined,
			};
		});
	}
	read(work: WorkState, id: string, botId: string, sessionId: string): void {
		const notice = this.list(work).find((n) => n.id === id);
		if (
			notice?.botId !== botId ||
			(notice.target?.sessionId ?? "") !== sessionId ||
			notice.delivery !== "delivered"
		)
			throw new Error("Notification target changed or is unavailable");
		if (notice.read) return;
		this.events.transact((state) => {
			const receipt = receipts(state)[id];
			if (!receipt) throw new Error("Notification delivery is not recorded");
			receipt.readAt ??= Date.now();
		});
	}
	close(): void {
		this.events.close();
	}
}
