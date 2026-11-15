/** Explicit host marker; arbitrary legacy payload.context values are application data. */
export interface ContextTarget {
	botId: string;
	projectId: string;
	sessionId: string;
	membershipRevision: number;
	projectName?: string;
	sessionName?: string;
}
const UUID =
	/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
export function capturedContext(payload: unknown): ContextTarget | undefined {
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
	const task = payload as {
		nestContextVersion?: unknown;
		context?: ContextTarget;
	};
	if (task.nestContextVersion === undefined) return;
	if (task.nestContextVersion !== 1)
		throw Error(
			"Unsupported captured Nest context version; inspection required",
		);
	const target = task.context;
	if (
		!target ||
		typeof target !== "object" ||
		Array.isArray(target) ||
		typeof target.botId !== "string" ||
		!UUID.test(target.projectId) ||
		!UUID.test(target.sessionId) ||
		!Number.isSafeInteger(target.membershipRevision) ||
		target.membershipRevision < 1
	)
		throw Error("Invalid captured Nest context");
	for (const value of [target.projectName, target.sessionName])
		if (
			value !== undefined &&
			(typeof value !== "string" || !value.trim() || value.length > 100)
		)
			throw Error("Invalid captured context name");
	return target;
}
