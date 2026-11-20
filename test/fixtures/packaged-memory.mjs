import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { DurableWorkStore } from "@cybergarage/orbit/dist/core/execution/scheduled-work.js";
import { Message } from "@cybergarage/orbit/dist/core/message/message.js";
import { getToolResult } from "@cybergarage/orbit/dist/core/models/adapters/tools.js";
import {
	toolResultText,
	normalizeToolResult,
} from "@cybergarage/orbit/dist/core/tools/definition.js";

// Run with Electron's Node mode: no BrowserWindow, screen capture or model service.
const { openContext } = await import(
	pathToFileURL(path.resolve("dist/catalog-native/context.mjs")).href
);
const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-packaged-memory-"));
const store = new DurableWorkStore(path.join(root, "work.json"));
const host = {
	store,
	bot: () => ({ provider: "ollama", model: "synthetic", profileRevision: 0 }),
	canSearchProjectMemory: () => true,
};
let context;
try {
	await fs.mkdir(path.join(root, ".orbit"));
	await fs.writeFile(
		path.join(root, ".orbit", "settings.json"),
		JSON.stringify({
			tools: { profile: "coding", include: ["bash", "glob"] },
			mcp: { servers: { forbidden: { command: "never-start" } } },
		}),
	);
	context = await openContext(path.join(root, "context"), host);
	const project = randomUUID(),
		source = randomUUID(),
		target = randomUUID();
	await context.createProject("synthetic", "Catalog", project);
	await context.createSession("synthetic", project, "Source", source);
	await context.createSession("synthetic", project, "Question", target);
	await context.select("synthetic", source);
	await context.addMemory(
		"synthetic",
		"Cobalt is the saved catalog color.",
		randomUUID(),
	);
	await context.select("synthetic", target);
	let calls = 0;
	const model = {
		getModel: () => "synthetic",
		getProvider: () => "ollama",
		getName: () => "synthetic",
		async getCapabilities() {
			return { source: "adapter", tools: "supported" };
		},
		async invoke(messages, options) {
			calls++;
			assert.deepEqual(
				options.tools.map((tool) => tool.name),
				["project_memory_search"],
			);
			const result = getToolResult(messages.at(-1));
			if (result)
				return new Message("assistant", {
					content: toolResultText(normalizeToolResult(result.output)),
				});
			assert.doesNotMatch(JSON.stringify(messages), /Cobalt/);
			return new Message("assistant", {
				payload: {
					toolCalls: [
						{
							id: "read-color",
							name: "project_memory_search",
							input: { query: "Cobalt", limit: 2 },
						},
					],
				},
			});
		},
	};
	// Parsing this file would fail; the compiled Agent must not discover it.
	await fs.writeFile(
		path.join(root, ".orbit", "settings.json"),
		"{invalid workspace settings",
	);
	const lease = await context.begin(
		context.selection("synthetic"),
		"synthetic-run",
		true,
	);
	try {
		assert.equal(typeof lease.chat, "function");
		const answer = await lease.chat(
			model,
			"Use only saved evidence.",
			"Recall the color.",
			new AbortController().signal,
		);
		assert.match(answer, /Cobalt/);
		assert.equal(calls, 2);
	} finally {
		await lease.close();
	}
	console.log(
		"Packaged Electron memory search passed without a window or real inference.",
	);
} finally {
	await context?.close();
	store.close();
	await fs.rm(root, { recursive: true, force: true });
}
