import fs from "node:fs/promises";
import { AppleFoundationModelsAgent } from "@cybergarage/orbit/dist/core/models/adapters/apple.js";
import { createProvider } from "@cybergarage/orbit/dist/core/models/provider.js";
import {
	Message,
	MessageType,
} from "@cybergarage/orbit/dist/core/message/message.js";
export type LocalProvider = "ollama" | "apple";
export interface ModelCatalog {
	ollama: {
		status: "ready" | "offline" | "empty" | "error";
		models: { name: string; chat: boolean | null }[];
		message: string;
	};
	apple: { available: boolean; message: string };
	cloud: { enabled: false; message: string };
}
export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}
export interface LocalModelAccess {
	catalog(): Promise<ModelCatalog>;
	appleChat(messages: ChatMessage[], signal: AbortSignal): Promise<string>;
}
async function json(response: Response): Promise<unknown> {
	if (!response.ok)
		throw Error(`Local model service returned HTTP ${response.status}`);
	const reader = response.body?.getReader();
	if (!reader) throw Error("Local model service returned an empty response");
	let text = "",
		bytes = 0;
	const decoder = new TextDecoder();
	try {
		for (;;) {
			const chunk = await reader.read();
			if (chunk.done) break;
			bytes += chunk.value.length;
			if (bytes > 256 * 1024)
				throw Error("Local model inventory exceeds 256 KiB");
			text += decoder.decode(chunk.value, { stream: true });
		}
	} finally {
		await reader.cancel();
	}
	return JSON.parse(text + decoder.decode());
}
export class LocalModels implements LocalModelAccess {
	constructor(
		private readonly helperPath?: string,
		private readonly localFetch: typeof fetch = fetch,
	) {}
	async catalog(): Promise<ModelCatalog> {
		const [ollama, apple] = await Promise.all([this.ollama(), this.apple()]);
		return {
			ollama,
			apple,
			cloud: {
				enabled: false,
				message:
					"Cloud execution is not configured. Only explicit local providers are available; no fallback.",
			},
		};
	}
	private async ollama(): Promise<ModelCatalog["ollama"]> {
		let reached = false;
		try {
			const response = await this.localFetch(
				"http://127.0.0.1:11434/api/tags",
				{ signal: AbortSignal.timeout(3000) },
			);
			reached = true;
			const body = (await json(response)) as { models?: { name?: unknown }[] };
			if (!Array.isArray(body.models)) throw Error("Invalid inventory");
			const names = [
				...new Set(
					body.models
						.map((m) => m.name)
						.filter(
							(n): n is string =>
								typeof n === "string" && n.length > 0 && n.length <= 200,
						),
				),
			].sort();
			if (!names.length)
				return {
					status: "empty",
					models: [],
					message:
						"Ollama is connected but no models are installed. Install a text model yourself in Ollama, then check again. Nest does not download models.",
				};
			const models = await Promise.all(
				names.slice(0, 30).map(async (name) => {
					let chat: boolean | null = null;
					try {
						const detail = (await json(
							await this.localFetch("http://127.0.0.1:11434/api/show", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ model: name }),
								signal: AbortSignal.timeout(3000),
							}),
						)) as { capabilities?: unknown };
						if (Array.isArray(detail.capabilities))
							chat = detail.capabilities.includes("completion");
					} catch {
						/* Older local servers may not report capabilities. Selection remains explicit. */
					}
					return { name, chat };
				}),
			);
			return {
				status: "ready",
				models,
				message: `Ollama connected at 127.0.0.1:11434. ${names.length} installed model(s)${names.length > 30 ? "; showing the first 30" : ""}. Select an installed text model for each Companion. Embedding-only models cannot chat.`,
			};
		} catch {
			if (reached)
				return {
					status: "error",
					models: [],
					message:
						"Ollama responded but its model inventory could not be read. Check the existing service/version and retry. No automatic setup or fallback.",
				};
			return {
				status: "offline",
				models: [],
				message:
					"Cannot reach local Ollama at 127.0.0.1:11434. Start the existing Ollama app, then check again. No service setup, model download or cloud fallback is performed.",
			};
		}
	}
	private async apple(): Promise<ModelCatalog["apple"]> {
		if (process.platform !== "darwin" || process.arch !== "arm64")
			return {
				available: false,
				message:
					"Apple text chat requires an Apple silicon Mac with macOS 26 or newer. Ollama remains available on other platforms.",
			};
		if (!this.helperPath)
			return {
				available: false,
				message:
					"Optional Apple helper is not included. Build it explicitly with npm run apple:build, or use a packaged build that includes it. No automatic setup.",
			};
		try {
			await fs.access(this.helperPath, fs.constants.X_OK);
			const probe = await new AppleFoundationModelsAgent(
				"system",
				createProvider("apple"),
				{ helperPath: this.helperPath, timeoutMs: 5000 },
			).probeAvailability();
			return {
				available: probe.available,
				message: probe.available
					? "Apple Foundation Models available locally · text chat only. No tools, streaming, structured generation or source reviews."
					: `Apple model unavailable: ${probe.reason ?? "unknown"}. Review Apple Intelligence readiness in macOS yourself, then recheck. Nest does not enable settings or download assets.`,
			};
		} catch {
			return {
				available: false,
				message:
					"Optional Apple helper/model is unavailable. Check the packaged helper or explicit build, compatible macOS and user-managed Apple Intelligence readiness. No automatic changes or fallback.",
			};
		}
	}
	async appleChat(
		messages: ChatMessage[],
		signal: AbortSignal,
	): Promise<string> {
		if (!this.helperPath)
			throw Error(
				"Optional Apple helper is missing. Use an Apple-enabled build or explicitly build the helper; no fallback.",
			);
		const model = new AppleFoundationModelsAgent(
			"system",
			createProvider("apple"),
			{ helperPath: this.helperPath, timeoutMs: 120000 },
		);
		try {
			const response = await model.invoke(
				messages.map(
					(m) =>
						new Message(
							m.role === "system"
								? MessageType.Session
								: m.role === "user"
									? MessageType.User
									: MessageType.Assistant,
							{ content: m.content },
						),
				),
				{ signal, maxOutputTokens: 512 },
			);
			if (!response.content.trim()) throw Error("Empty Apple response");
			return response.content;
		} catch (error) {
			if (signal.aborted) throw error;
			throw Error(
				`Apple text chat could not complete: ${error instanceof Error ? error.message : "model unavailable"}. Check readiness or shorten the conversation/profile for the system context limit. No Ollama or cloud fallback was used.`,
			);
		}
	}
}
