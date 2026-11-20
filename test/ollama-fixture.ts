import { Runtime } from "../src/runtime";

/** Existing text fixtures now also serve Core's adapter metadata probes. */
export class SyntheticRuntime extends Runtime {
	constructor(...args: ConstructorParameters<typeof Runtime>) {
		const fetcher = args[1];
		if (fetcher)
			args[1] = (async (url, init) => {
				let endpoint: string;
				if (typeof url === "string") endpoint = url;
				else if (url instanceof URL) endpoint = url.href;
				else endpoint = url.url;
				if (endpoint.endsWith("/api/show"))
					return Response.json({ capabilities: ["completion", "tools"] });
				if (endpoint.endsWith("/api/ps")) return Response.json({ models: [] });
				const response = await fetcher(url, init);
				if (!response.ok) return response;
				const body = await response.clone().json();
				if (!body.message) return response;
				return Response.json({
					model:
						(typeof init?.body === "string"
							? JSON.parse(init.body).model
							: undefined) ?? "synthetic",
					created_at: "2026-11-20T00:00:00.000Z",
					done: true,
					done_reason: "stop",
					total_duration: 0,
					load_duration: 0,
					prompt_eval_duration: 0,
					eval_duration: 0,
					prompt_eval_count: 1,
					eval_count: 1,
					...body,
					message: { role: "assistant", ...body.message },
				});
			}) as typeof fetch;
		super(...args);
	}
}
