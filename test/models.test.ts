import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
	LocalModels,
	type LocalModelAccess,
	type ModelCatalog,
	type ChatMessage,
} from "../src/models";
import { Runtime } from "../src/runtime";

const ready: ModelCatalog = {
	ollama: {
		status: "ready",
		message: "synthetic installed inventory",
		models: [
			{ name: "gemma4:12b", chat: true },
			{ name: "small:latest", chat: true },
			{ name: "embedding:latest", chat: false },
		],
	},
	apple: { available: true, message: "synthetic Apple available; text only" },
	cloud: { enabled: false, message: "not configured" },
};
test("local inventory distinguishes offline, empty, invalid and embedding-only models", async () => {
	const offline = new LocalModels(undefined, (async () => {
		throw Error("offline");
	}) as typeof fetch);
	assert.equal((await offline.catalog()).ollama.status, "offline");
	const empty = new LocalModels(undefined, (async () =>
		Response.json({ models: [] })) as typeof fetch);
	assert.equal((await empty.catalog()).ollama.status, "empty");
	const invalid = new LocalModels(undefined, (async () =>
		Response.json({ wrong: true })) as typeof fetch);
	assert.equal((await invalid.catalog()).ollama.status, "error");
	const calls: string[] = [];
	const live = new LocalModels(undefined, (async (url, init) => {
		calls.push(String(url));
		return String(url).endsWith("/api/tags")
			? Response.json({
					models: [{ name: "text:latest" }, { name: "embedding:latest" }],
				})
			: Response.json({
					capabilities: String(init?.body).includes("embedding")
						? ["embedding"]
						: ["completion"],
				});
	}) as typeof fetch);
	const catalog = await live.catalog();
	assert.equal(catalog.ollama.status, "ready");
	assert.equal(
		catalog.ollama.models.find((m) => m.name === "embedding:latest")?.chat,
		false,
	);
	assert.equal(
		catalog.ollama.models.find((m) => m.name === "text:latest")?.chat,
		true,
	);
	assert.equal(catalog.cloud.enabled, false);
	assert.ok(calls.every((url) => url.startsWith("http://127.0.0.1:11434/")));
	assert.equal(catalog.apple.available, false);
});
test("explicit local provider selection persists; missing/cloud/unsupported choices cannot silently switch", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-models-"));
	const requests: ChatMessage[][] = [];
	let ollamaCalls = 0;
	const access: LocalModelAccess = {
		catalog: async () => structuredClone(ready),
		appleChat: async (messages) => {
			requests.push(messages);
			return "Synthetic Apple reply: cobalt.";
		},
	};
	const ollama = (async () => {
		ollamaCalls++;
		return Response.json({ message: { content: "Synthetic Ollama reply" } });
	}) as typeof fetch;
	let runtime = new Runtime(path.join(root, "state.json"), ollama, access);
	try {
		const original = runtime.bot("documents");
		await assert.rejects(
			runtime.selectModel("research", "cloud", "paid", 0),
			/Cloud is not configured/,
		);
		await assert.rejects(
			runtime.selectModel("research", "ollama", "missing", 0),
			/not installed/,
		);
		await assert.rejects(
			runtime.selectModel("research", "ollama", "embedding:latest", 0),
			/embedding-only/,
		);
		const queued = runtime.submit(
			"research",
			"Queued before model change",
			"queued-before",
			"chat",
		);
		const other = runtime.submit(
			"documents",
			"Other Companion task",
			"other",
			"chat",
		);
		await runtime.selectModel("research", "apple", "system", 0);
		assert.equal(
			runtime.store.snapshot().runs.find((r) => r.id === queued)?.status,
			"cancelled",
		);
		assert.equal(
			runtime.store.snapshot().runs.find((r) => r.id === other)?.status,
			"queued",
		);
		assert.deepEqual(runtime.bot("documents"), original);
		runtime.cancel(other);
		assert.throws(
			() => runtime.preview("research", "Read page", "summary"),
			/text chat only/,
		);
		const preview = runtime.preview("research", "Remember cobalt", "chat");
		assert.match(preview.execution, /Local.*Apple/);
		const id = runtime.submit(
			"research",
			"Remember cobalt",
			"apple-first",
			"chat",
		);
		await runtime.tick();
		assert.equal(
			runtime.store.snapshot().runs.find((r) => r.id === id)?.status,
			"succeeded",
		);
		assert.equal(ollamaCalls, 0);
		assert.equal(requests.length, 1);
		runtime.remember(id);
		await runtime.close();
		runtime = new Runtime(path.join(root, "state.json"), ollama, access);
		assert.equal(runtime.bot("research").provider, "apple");
		assert.equal(runtime.bot("research").model, "system");
		assert.equal(
			runtime.store.snapshot().runs.filter((r) => r.status === "approval")
				.length,
			1,
		);
		const second = runtime.submit(
			"research",
			"What color?",
			"apple-second",
			"chat",
		);
		await runtime.tick();
		assert.equal(
			runtime.submit("research", "What color?", "apple-second", "chat"),
			second,
		);
		assert.equal(requests[1][1].content, "Remember cobalt");
		assert.match(requests[1][2].content, /cobalt/);
		assert.equal(
			(
				runtime.store.snapshot().data.modelEvidence as Record<
					string,
					{ provider: string }
				>
			)[second].provider,
			"apple",
		);
		const rev = runtime.bot("research").profileRevision;
		await runtime.selectModel("research", "ollama", "small:latest", rev);
		assert.equal(
			runtime.store.snapshot().runs.filter((r) => r.status === "approval")
				.length,
			1,
		);
		await assert.rejects(
			runtime.selectModel("research", "apple", "system", rev),
			/stale/,
		);
		assert.equal(runtime.bot("research").model, "small:latest");
		assert.equal(ollamaCalls, 0);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
test("Apple cancellation and unavailable model produce truthful terminal states without Ollama fallback", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-apple-cancel-"));
	let start: () => void = () => {};
	const started = new Promise<void>((resolve) => {
		start = resolve;
	});
	let unavailable = false;
	let ollamaCalls = 0;
	const access: LocalModelAccess = {
		catalog: async () => ready,
		appleChat: async (_messages, signal) => {
			if (unavailable)
				throw Error("Synthetic Apple model unavailable; no fallback");
			start();
			return new Promise<string>((_resolve, reject) =>
				signal.addEventListener("abort", () => reject(Error("cancelled")), {
					once: true,
				}),
			);
		},
	};
	const runtime = new Runtime(
		path.join(root, "state.json"),
		(async () => {
			ollamaCalls++;
			throw Error("unexpected fallback");
		}) as typeof fetch,
		access,
	);
	try {
		await runtime.selectModel("research", "apple", "system", 0);
		const id = runtime.submit(
			"research",
			"Synthetic long reply",
			"cancel-apple",
			"chat",
		);
		const tick = runtime.tick();
		await started;
		runtime.cancel(id);
		await tick;
		assert.equal(
			runtime.store.snapshot().runs.find((r) => r.id === id)?.status,
			"cancelled",
		);
		assert.equal(
			runtime.store.snapshot().runs.find((r) => r.id === id)?.result,
			undefined,
		);
		unavailable = true;
		const failed = runtime.submit(
			"research",
			"Synthetic short reply",
			"unavailable-apple",
			"chat",
		);
		await runtime.tick();
		assert.equal(
			runtime.store.snapshot().runs.find((r) => r.id === failed)?.status,
			"failed",
		);
		assert.equal(ollamaCalls, 0);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("missing selected Ollama model is a saved failure with no fallback or baseline", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-missing-model-"));
	let calls = 0;
	const runtime = new Runtime(path.join(root, "state.json"), (async () => {
		calls++;
		return Response.json(
			{ error: "selected model not found" },
			{ status: 404 },
		);
	}) as typeof fetch);
	try {
		const id = runtime.submit(
			"research",
			"Explain a synthetic outline",
			"missing-model",
			"chat",
		);
		await runtime.tick();
		const run = runtime.store.snapshot().runs.find((r) => r.id === id);
		assert.equal(run?.status, "failed");
		assert.match(run?.result ?? "", /selected model request \(404\)/);
		assert.match(run?.result ?? "", /No cloud fallback/);
		assert.equal(calls, 1);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("unsupported saved provider fails closed before any model call", async () => {
	const root = await fs.mkdtemp(
		path.join(os.tmpdir(), "nest-unsupported-provider-"),
	);
	let calls = 0;
	const runtime = new Runtime(path.join(root, "state.json"), (async () => {
		calls++;
		throw Error("unexpected fallback");
	}) as typeof fetch);
	try {
		runtime.store.setData(
			"bots",
			runtime
				.bots()
				.map((b) => (b.id === "research" ? { ...b, provider: "cloud" } : b)),
		);
		assert.throws(
			() => runtime.preview("research", "Synthetic task", "chat"),
			/Unsupported saved provider/,
		);
		const id = runtime.store.enqueue("unsupported-saved", {
			botId: "research",
			kind: "chat",
			prompt: "Synthetic task",
			scope: { folder: "", page: "" },
		});
		await runtime.tick();
		assert.equal(
			runtime.store.snapshot().runs.find((r) => r.id === id)?.status,
			"failed",
		);
		assert.equal(calls, 0);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
