import type {
	ScheduledRun,
	WorkState,
	WorkStatus,
} from "@cybergarage/orbit/dist/core/execution/scheduled-work.js";
export interface WorkflowPreview {
	token: string;
	botId: string;
	prompt: string;
	mode: string;
	action: string;
	scope: string;
	limits: string;
}
export const STATUS_LABELS: Record<WorkStatus, string> = {
	approval: "Approval required",
	queued: "Queued",
	running: "Running",
	succeeded: "Completed",
	failed: "Failed",
	cancelled: "Cancelled",
	unknown: "Unknown / interrupted",
};
export function scopeLabel(payload: unknown): string {
	if (!payload || typeof payload !== "object" || Array.isArray(payload))
		return "Unrecognized source metadata; inspect execution evidence";
	const p = payload as {
		kind?: string;
		scope?: { folder?: string; page?: string; files?: string[] };
	};
	if (p.kind === "memory") return "This Companion's local memory only";
	if (p.kind === "chat") return "Local conversation · no new source reading";
	if (p.scope?.folder)
		return p.scope.files?.length
			? `${p.scope.folder} · ${p.scope.files.join(", ")}`
			: `${p.scope.folder} · bounded top-level text files (legacy summary)`;
	return p.scope?.page || "No source captured in this record";
}
export function companionActivity(
	state: WorkState,
	botId: string,
): {
	active: ScheduledRun[];
	recentResult?: ScheduledRun;
	unresolved: ScheduledRun[];
} {
	const runs = state.runs.filter(
		(r) => (r.payload as { botId?: string } | null)?.botId === botId,
	);
	return {
		unresolved: runs.filter((r) => r.status === "unknown"),
		active: runs.filter((r) =>
			["queued", "running", "approval"].includes(r.status),
		),
		recentResult: runs
			.slice()
			.reverse()
			.find(
				(r) =>
					r.status === "succeeded" &&
					typeof r.result === "string" &&
					r.result.length > 0,
			),
	};
}
