export type Template = "moku" | "writing" | "research" | "custom";
export interface FocusSession {
	id: string;
	step: string;
	status: "active" | "paused" | "closed";
	remaining: number;
	started: number;
	progress: string;
	nextStep: string;
}
export interface LifeState {
	revision: number;
	enabled: boolean;
	decorations: string[];
	placed: string[];
	events: string[];
	day: string;
	awards: string[];
	session?: FocusSession;
	history?: FocusSession[];
}
export const emptyLife = (): LifeState => ({
	revision: 0,
	enabled: false,
	decorations: [],
	placed: [],
	events: [],
	day: "",
	awards: [],
});
export function remaining(session: FocusSession, now = Date.now()): number {
	return Math.max(
		0,
		session.remaining -
			(session.status === "active" ? Math.max(0, now - session.started) : 0),
	);
}
export function updateLife(
	old: LifeState,
	input: Record<string, unknown>,
	now = Date.now(),
): LifeState {
	if (
		typeof input.eventId !== "string" ||
		!/^[a-zA-Z0-9-]{1,150}$/.test(input.eventId)
	)
		throw Error("Stable event ID required");
	if (old.events.includes(input.eventId)) return old;
	if (input.revision !== old.revision)
		throw Error("Focus state changed; reload before trying again");
	const next = structuredClone(old);
	const text = (key: string, required = false): string => {
		const value = input[key];
		if (
			typeof value !== "string" ||
			value.length > 2000 ||
			(required && !value.trim())
		)
			throw Error("Enter a bounded step or note (up to 2,000 characters)");
		return value.trim();
	};
	const award = (kind: string) => {
		if (!next.enabled) return;
		const day = new Date(now).toISOString().slice(0, 10);
		// UTC high-water day prevents backwards clock/date changes granting another batch.
		if (day > next.day) {
			next.day = day;
			next.awards = [];
		}
		if (day < next.day || next.awards.includes(kind) || next.awards.length >= 2)
			return;
		next.awards.push(kind);
		const item = ["leaf cushion", "acorn", "desk plant"].find(
			(d) => !next.decorations.includes(d),
		);
		if (item) next.decorations.push(item);
	};
	switch (input.action) {
		case "start":
			if (next.session && next.session.status !== "closed")
				throw Error(
					"Pause or close the current session before starting another",
				);
			next.session = {
				id: input.eventId,
				step: text("step", true),
				status: "active",
				remaining: 25 * 60_000,
				started: now,
				progress: "",
				nextStep: "",
			};
			award("start");
			break;
		case "pause":
			if (next.session?.status !== "active")
				throw Error("No active focus session");
			next.session.remaining = remaining(next.session, now);
			next.session.status = "paused";
			break;
		case "resume":
			if (next.session?.status !== "paused" || next.session.remaining <= 0)
				throw Error(
					"The timer ended; leave a note before starting another session",
				);
			next.session.status = "active";
			next.session.started = now;
			break;
		case "close":
			if (!next.session || next.session.status === "closed")
				throw Error("No open focus session");
			next.session.remaining = remaining(next.session, now);
			next.session.status = "closed";
			next.session.progress = text("progress");
			next.session.nextStep = text("nextStep");
			next.history = [...(next.history ?? []), structuredClone(next.session)];
			award("closure");
			break;
		case "nurturing":
			if (typeof input.enabled !== "boolean")
				throw Error("Invalid nurturing choice");
			next.enabled = input.enabled;
			break;
		case "decoration": {
			const item = text("item", true);
			if (!next.decorations.includes(item) || typeof input.placed !== "boolean")
				throw Error("Choose a collected decoration");
			next.placed = next.placed.filter((d) => d !== item);
			if (input.placed) next.placed.push(item);
			break;
		}
		default:
			throw Error("Unknown focus action");
	}
	next.events.push(input.eventId);
	next.revision++;
	return next;
}
