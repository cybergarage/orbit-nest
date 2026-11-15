export interface PendingInput {
	id: string;
	sessionId: string;
	prompt: string;
	requestId: string;
	previewToken?: string;
}
const KEY = "nest-unconfirmed-local-inputs-v1";
export function pendingInputs(storage: Storage): PendingInput[] {
	const raw = storage.getItem(KEY);
	if (!raw) return [];
	const values = JSON.parse(raw) as PendingInput[];
	if (
		!Array.isArray(values) ||
		values.length > 200 ||
		values.some(
			(value) =>
				!value ||
				typeof value.id !== "string" ||
				typeof value.sessionId !== "string" ||
				typeof value.prompt !== "string" ||
				!value.prompt.trim() ||
				value.prompt.length > 4000 ||
				typeof value.requestId !== "string" ||
				(value.previewToken !== undefined &&
					typeof value.previewToken !== "string") ||
				!/^[a-zA-Z0-9-]{1,150}$/.test(value.requestId),
		) ||
		new Set(values.map((value) => value.requestId)).size !== values.length
	)
		throw new Error(
			"Unconfirmed local input needs inspection; no resend was attempted",
		);
	return values;
}
export function prepareInput(
	storage: Storage,
	input: PendingInput,
): PendingInput {
	if (!input.prompt.trim() || input.prompt.length > 4000)
		throw new Error("Enter a message of 1–4,000 characters");
	const values = pendingInputs(storage);
	const prior = values.find(
		(value) => value.id === input.id && value.sessionId === input.sessionId,
	);
	if (prior) {
		if (prior.prompt !== input.prompt)
			throw new Error(
				"An earlier send is unconfirmed. Check its receipt before sending different text.",
			);
		if (input.previewToken !== undefined) {
			const refreshed = { ...prior, previewToken: input.previewToken };
			storage.setItem(
				KEY,
				JSON.stringify(
					values.map((value) =>
						value.requestId === prior.requestId ? refreshed : value,
					),
				),
			);
			return refreshed;
		}
		return prior;
	}
	if (values.length >= 200)
		throw new Error("Unconfirmed local input limit reached");
	storage.setItem(KEY, JSON.stringify([...values, input]));
	return input;
}
export function acknowledgeInput(storage: Storage, requestId: string): void {
	storage.setItem(
		KEY,
		JSON.stringify(
			pendingInputs(storage).filter((input) => input.requestId !== requestId),
		),
	);
}
