import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Message } from "@cybergarage/orbit/dist/core/message/message.js";
import { Runtime } from "../src/runtime";
import { ProjectContext } from "../src/project-context";

type Wire = {
	model: string;
	messages: { role: string; content: string }[];
	tools?: { function: { name: string; parameters: unknown } }[];
};
async function fixture(
	capability: "supported" | "unsupported" | "unknown" = "supported",
) {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-memory-search-"));
	const calls: Wire[] = [];
	let input: Record<string, unknown> = { query: "cobalt", limit: 3 };
	let onChat: (() => void | Promise<void>) | undefined;
	const fetcher = (async (url, init) => {
		assert.match(
			String(url),
			/^http:\/\/127\.0\.0\.1:11434\/api\/(show|ps|chat)$/,
		);
		if (String(url).endsWith("/show"))
			return Response.json(
				capability === "unknown"
					? {}
					: {
							capabilities:
								capability === "supported"
									? ["completion", "tools"]
									: ["completion"],
						},
			);
		if (String(url).endsWith("/ps")) return Response.json({ models: [] });
		const wire: Wire = JSON.parse(String(init?.body));
		calls.push(wire);
		await onChat?.();
		const tool = wire.messages.at(-1)?.role === "tool";
		let content = "No search available.";
		let tool_calls:
			| { function: { name: string; arguments: Record<string, unknown> } }[]
			| undefined;
		if (tool) content = wire.messages.at(-1)?.content ?? "";
		else if (
			wire.tools?.some(
				(entry) => entry.function.name === "project_memory_search",
			)
		) {
			content = "";
			tool_calls = [
				{ function: { name: "project_memory_search", arguments: input } },
			];
		}
		return Response.json({
			model: wire.model,
			created_at: "2026-11-20T00:00:00.000Z",
			done: true,
			done_reason: "stop",
			total_duration: 0,
			load_duration: 0,
			prompt_eval_duration: 0,
			eval_duration: 0,
			prompt_eval_count: 1,
			eval_count: 1,
			message: {
				role: "assistant",
				content,
				...(tool_calls ? { tool_calls } : {}),
			},
		});
	}) as typeof fetch;
	let runtime = new Runtime(path.join(root, "work.json"), fetcher);
	runtime.context = await ProjectContext.open(
		path.join(root, "context"),
		runtime,
	);
	const project = randomUUID(),
		source = randomUUID(),
		target = randomUUID(),
		other = randomUUID(),
		foreign = randomUUID();
	await runtime.context.createProject("research", "Catalog", project);
	await runtime.context.createSession("research", project, "Source", source);
	await runtime.context.createSession("research", project, "Question", target);
	await runtime.context.createProject("research", "Other", other);
	await runtime.context.createSession("research", other, "Private", foreign);
	const found = await runtime.context.repository.findById(source);
	assert.ok(found);
	const session = runtime.context.repository.open(found.file);
	const [message] = session.appendMessages([
		new Message("user", { content: "Use cobalt for the catalog status." }),
	]);
	await session.synchronize("file-sync");
	await session.close();
	await runtime.context.memory.saveExcerpt(project, {
		sessionId: source,
		messageId: message.id,
		excerpt: message.content,
		title: "Catalog status",
		operationId: randomUUID(),
	});
	await runtime.context.select("research", target);
	return {
		root,
		calls,
		project,
		source,
		target,
		other,
		foreign,
		get context() {
			assert.ok(runtime.context);
			return runtime.context;
		},
		get runtime() {
			return runtime;
		},
		setInput(value: typeof input) {
			input = value;
		},
		onChat(value: typeof onChat) {
			onChat = value;
		},
		async restart() {
			await runtime.close();
			runtime = new Runtime(path.join(root, "work.json"), fetcher);
			runtime.context = await ProjectContext.open(
				path.join(root, "context"),
				runtime,
			);
		},
		async send(id: string) {
			await runtime.chat("research", "Recall the catalog status.", id);
			await runtime.tick();
			const run = runtime.store
				.snapshot()
				.runs.find((run) => run.id === `message:${id}`);
			assert.ok(run);
			return run;
		},
		async close() {
			await runtime.close();
			await fs.rm(root, { recursive: true, force: true });
		},
	};
}

for (const capability of ["supported", "unknown", "unsupported"] as const)
	test(`Core owns Project search and selected-model ${capability} handling`, async () => {
		const f = await fixture(capability);
		try {
			await f.restart();
			assert.equal(
				f.runtime.context?.selection("research")?.sessionId,
				f.target,
			);
			const run = await f.send("recall");
			assert.equal(run.status, "succeeded", run.result);
			assert.doesNotMatch(JSON.stringify(f.calls[0].messages), /cobalt/i);
			assert.ok(
				f.calls.every((call) => call.model === f.runtime.bot("research").model),
			);
			assert.deepEqual(
				f.calls[0].tools?.map((entry) => entry.function.name) ?? [],
				capability === "unsupported" ? [] : ["project_memory_search"],
			);
			if (capability !== "unsupported") {
				assert.match(run.result ?? "", /cobalt/);
				assert.match(run.result ?? "", new RegExp(f.source));
			} else assert.doesNotMatch(run.result ?? "", /cobalt/);
			assert.equal(f.runtime.store.snapshot().data.contextEvidence, undefined);
			await f.restart();
			await f.send("next");
			assert.equal(
				f.runtime.store.snapshot().data.contextRecoveryError ?? "",
				"",
			);
		} finally {
			await f.close();
		}
	});

test("a different Project and an unassigned legacy conversation cannot read the source", async () => {
	const f = await fixture();
	try {
		await f.context.select("research", f.foreign);
		const foreign = await f.send("foreign");
		assert.equal(foreign.status, "succeeded", foreign.result);
		assert.doesNotMatch(foreign.result ?? "", /cobalt/);
		await f.context.select("research", "");
		const legacy = await f.send("legacy");
		assert.equal(legacy.status, "succeeded");
		assert.equal(f.calls.at(-1)?.tools, undefined);
		assert.doesNotMatch(legacy.result ?? "", /cobalt/);
	} finally {
		await f.close();
	}
});

test("denied and revoked host permission cannot expose new memory", async () => {
	const f = await fixture();
	try {
		f.runtime.canSearchProjectMemory = () => false;
		const denied = await f.send("denied");
		assert.equal(denied.status, "succeeded", denied.result);
		assert.equal(f.calls[0].tools, undefined);
		assert.doesNotMatch(denied.result ?? "", /cobalt/);
		Reflect.set(f.runtime, "canSearchProjectMemory", undefined);
		const unknown = await f.send("unknown-permission");
		assert.equal(unknown.status, "succeeded", unknown.result);
		assert.doesNotMatch(unknown.result ?? "", /cobalt/);
		let allowed = true;
		f.runtime.canSearchProjectMemory = () => allowed;
		f.onChat(() => {
			allowed = false;
		});
		const revoked = await f.send("revoked");
		assert.equal(revoked.status, "failed");
		assert.doesNotMatch(revoked.result ?? "", /cobalt/);
		f.onChat(undefined);
		f.runtime.canSearchProjectMemory = () => true;
		await f.send("after-revoke");
		assert.equal(
			f.runtime.store.snapshot().data.contextRecoveryError ?? "",
			"",
		);
	} finally {
		await f.close();
	}
});

test("model scope injection is rejected by Core's canonical schema", async () => {
	const f = await fixture();
	try {
		f.setInput({ query: "cobalt", limit: 3, projectId: f.project });
		const run = await f.send("injected");
		assert.doesNotMatch(run.result ?? "", /Use cobalt/);
		assert.ok(
			f.calls.at(-1)?.messages.at(-1)?.role === "tool" ||
				run.status === "failed",
		);
	} finally {
		await f.close();
	}
});

test("changed canonical membership and a forged Bot binding fail before inference", async () => {
	const f = await fixture();
	try {
		await f.runtime.chat("research", "Recall", "queued");
		await f.context.projects.changeMembership(f.target, {
			sourceProjectId: f.project,
			projectId: f.other,
			expectedRevision: 1,
			operationId: randomUUID(),
		});
		await f.runtime.tick();
		assert.equal(f.runtime.store.snapshot().runs[0].status, "failed");
		assert.equal(f.calls.length, 0);
		const target = f.context.selection("research");
		assert.ok(target);
		f.runtime.store.enqueue("forged-bot", {
			kind: "chat",
			botId: "documents",
			prompt: "Recall",
			nestContextVersion: 1,
			context: target,
		});
		await f.runtime.tick();
		assert.equal(f.calls.length, 0);
		assert.equal(
			f.runtime.store.snapshot().runs.find((run) => run.id === "forged-bot")
				?.status,
			"failed",
		);
	} finally {
		await f.close();
	}
});

test("revocation after a settled search discards the answer and preserves complete committed turns", async () => {
	const f = await fixture();
	try {
		let allowed = true;
		f.runtime.canSearchProjectMemory = () => allowed;
		f.onChat(() => {
			if (f.calls.length === 2) allowed = false;
		});
		const revoked = await f.send("settled-revoked");
		assert.equal(revoked.status, "failed");
		assert.doesNotMatch(revoked.result ?? "", /cobalt/);
		f.onChat(undefined);
		allowed = true;
		const before = f.calls.length;
		const retry = await f.send("new-request");
		assert.equal(retry.status, "succeeded", retry.result);
		assert.doesNotMatch(JSON.stringify(f.calls[before].messages), /cobalt/);
		assert.equal(f.calls[before + 1].messages.at(-1)?.role, "tool");
	} finally {
		await f.close();
	}
});

test("ambient workspace settings cannot add tools, MCP or another provider", async () => {
	const f = await fixture();
	try {
		await fs.mkdir(path.join(f.root, ".orbit"));
		await fs.writeFile(
			path.join(f.root, ".orbit", "settings.json"),
			JSON.stringify({
				provider: "openai",
				model: "not-selected",
				tools: { profile: "coding", include: ["bash", "read", "glob"] },
				mcp: { servers: { forbidden: { command: "never-start-this-server" } } },
			}),
		);
		const run = await f.send("ambient");
		assert.equal(run.status, "succeeded", run.result);
		assert.deepEqual(
			f.calls[0].tools?.map((tool) => tool.function.name),
			["project_memory_search"],
		);
	} finally {
		await f.close();
	}
});
