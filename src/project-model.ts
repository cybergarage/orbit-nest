import { Ollama } from "ollama";
import { OllamaAgent } from "@cybergarage/orbit/dist/core/models/adapters/ollama.js";
import { createProvider } from "@cybergarage/orbit/dist/core/models/provider.js";

/** Use Core's adapter and capability policy; keep Nest's explicit local endpoint. */
export function projectModel(
	name: string,
	localFetch: typeof fetch,
): OllamaAgent {
	return new OllamaAgent(
		name,
		createProvider("ollama", {
			providers: {
				ollama: { host: "http://127.0.0.1:11434", contextWindow: 16384 },
			},
		}),
		{
			client: new Ollama({ host: "http://127.0.0.1:11434", fetch: localFetch }),
		},
	);
}
