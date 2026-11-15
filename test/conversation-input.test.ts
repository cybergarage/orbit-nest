import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { once } from "node:events";
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Runtime } from "../src/runtime";
import { ProjectContext } from "../src/project-context";

const temporary = () => fs.mkdtemp(path.join(os.tmpdir(), "nest-input-"));
const provider = () => {
	const calls: string[] = [];
	const model = (async (_url, options) => {
		calls.push(String(options?.body));
		return Response.json({
			message: { content: "Synthetic message response" },
		});
	}) as typeof fetch;
	return { calls, model };
};
async function context(runtime: Runtime, root: string) {
	const bridge = await ProjectContext.open(path.join(root, "context"), runtime);
	runtime.context = bridge;
	const projectId = randomUUID(),
		sessionId = randomUUID();
	await bridge.createProject("research", "Synthetic Project", projectId);
	await bridge.createSession(
		"research",
		projectId,
		"Synthetic Session",
		sessionId,
	);
	return { bridge, projectId, sessionId };
}
test("receipt acceptance is distinct from execution; exact duplicate receipts and restart do not repeat inference", async () => {
	const root = await temporary(),
		file = path.join(root, "work.json"),
		{ calls, model } = provider();
	let runtime = new Runtime(file, model);
	try {
		await runtime.chat("research", "Synthetic input", "one", "");
		assert.equal(
			runtime.conversationInput.list(runtime.store)[0].status,
			"accepted",
		);
		assert.equal(runtime.store.snapshot().runs.length, 0);
		await runtime.chat("research", "Synthetic input", "one", "");
		await assert.rejects(
			runtime.chat("research", "Changed text", "one", ""),
			/Conflicting/,
		);
		await assert.rejects(
			runtime.chat("documents", "Synthetic input", "one", ""),
			/Conflicting/,
		);
		await assert.rejects(
			runtime.chat("research", "Synthetic input", "one", randomUUID()),
			/Conflicting/,
		);
		await runtime.close();
		runtime = new Runtime(file, model);
		runtime.conversationInput.reconcile(runtime.store);
		assert.equal(
			runtime.conversationInput.list(runtime.store)[0].status,
			"waiting",
		);
		assert.equal(calls.length, 0);
		await runtime.tick();
		assert.equal(
			runtime.conversationInput.list(runtime.store)[0].status,
			"result-saved",
		);
		const bytes = await fs.readFile(`${file}.messages.json`, "utf8");
		await runtime.chat("research", "Synthetic input", "one", "");
		await runtime.tick();
		assert.equal(await fs.readFile(`${file}.messages.json`, "utf8"), bytes);
		await runtime.close();
		runtime = new Runtime(file, model);
		await runtime.tick();
		assert.equal(calls.length, 1);
		assert.equal(runtime.store.snapshot().runs.length, 1);
		assert.equal(runtime.store.snapshot().attempts.length, 1);
		assert.equal(
			runtime.notifications.list(runtime.store.snapshot()).length,
			1,
		);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
for (const stage of ["accepted", "admitted", "enqueued", "bound"] as const) {
	test(`Project input interruption at ${stage} keeps original target and one transcript pair`, async () => {
		const root = await temporary(),
			file = path.join(root, "work.json"),
			{ calls, model } = provider();
		let runtime = new Runtime(file, model, undefined, undefined, (value) => {
			if (value === stage) throw new Error("Synthetic boundary interruption");
		});
		try {
			const { bridge, sessionId } = await context(runtime, root);
			await bridge.select("research", sessionId);
			if (stage === "accepted")
				await assert.rejects(
					runtime.chat(
						"research",
						"Original Project input",
						"project-one",
						sessionId,
					),
					/interruption/,
				);
			else {
				await runtime.chat(
					"research",
					"Original Project input",
					"project-one",
					sessionId,
				);
				assert.throws(
					() => runtime.conversationInput.reconcile(runtime.store),
					/interruption/,
				);
			}
			await bridge.select("research", "");
			await runtime.close();
			runtime = new Runtime(file, model);
			runtime.context = await ProjectContext.open(
				path.join(root, "context"),
				runtime,
			);
			await runtime.chat(
				"research",
				"Original Project input",
				"project-one",
				sessionId,
			);
			await runtime.tick();
			await runtime.tick();
			assert.equal(calls.length, 1);
			const receipt = runtime.conversationInput.list(runtime.store)[0];
			assert.equal(receipt.sessionId, sessionId);
			assert.equal(receipt.status, "result-saved");
			const source = await runtime.context.repository.findById(sessionId);
			assert.ok(source);
			const transcript = runtime.context.repository.open(source.file);
			try {
				assert.equal(
					transcript
						.getMessages()
						.filter((message) => ["user", "assistant"].includes(message.role))
						.length,
					2,
				);
			} finally {
				await transcript.close();
			}
			assert.equal(runtime.store.snapshot().attempts.length, 1);
		} finally {
			await runtime.close();
			await fs.rm(root, { recursive: true, force: true });
		}
	});
}
test("wrong current context and stale membership reject acceptance; accepted membership changes fail before model execution", async () => {
	const root = await temporary(),
		{ calls, model } = provider(),
		runtime = new Runtime(path.join(root, "work.json"), model);
	try {
		const { bridge, projectId, sessionId } = await context(runtime, root);
		await bridge.select("research", sessionId);
		await assert.rejects(
			runtime.chat("research", "Wrong context", "wrong", ""),
			/context changed/,
		);
		await runtime.chat("research", "Captured input", "captured", sessionId);
		const other = randomUUID();
		await bridge.createProject("research", "Other Project", other);
		await bridge.projects.changeMembership(sessionId, {
			sourceProjectId: projectId,
			projectId: other,
			expectedRevision: 1,
			operationId: randomUUID(),
		});
		await assert.rejects(
			runtime.chat("research", "Stale membership", "stale", sessionId),
			/membership changed/,
		);
		assert.equal(runtime.conversationInput.list(runtime.store).length, 1);
		await runtime.tick();
		assert.equal(calls.length, 0);
		assert.equal(
			runtime.conversationInput.list(runtime.store)[0].status,
			"failed",
		);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
for (const admitted of [false, true]) {
	test(`stop cancels ${admitted ? "admitted" : "accepted"} input without reviving it on retry`, async () => {
		const root = await temporary(),
			file = path.join(root, "work.json"),
			{ calls, model } = provider();
		let runtime = new Runtime(file, model);
		try {
			await runtime.chat("research", "Do not execute", "stopped", "");
			if (admitted) runtime.conversationInput.reconcile(runtime.store);
			runtime.stopCompanion("research");
			await runtime.close();
			runtime = new Runtime(file, model);
			await runtime.chat("research", "Do not execute", "stopped", "");
			await runtime.tick();
			assert.equal(
				runtime.conversationInput.list(runtime.store)[0].status,
				"cancelled",
			);
			assert.equal(calls.length, 0);
			assert.equal(runtime.store.snapshot().attempts.length, 0);
		} finally {
			await runtime.close();
			await fs.rm(root, { recursive: true, force: true });
		}
	});
}
for (const receiptFailure of [false, true]) {
	test(`running cancellation preserves work stop when receipt failure is ${receiptFailure}`, async () => {
		const root = await temporary();
		let activeSignal: AbortSignal | null | undefined;
		let release = () => {};
		let enter = () => {};
		const entered = new Promise<void>((resolve) => {
			enter = resolve;
		});
		const model = (async (_url, options) => {
			activeSignal = options?.signal;
			enter();
			await new Promise<void>((resolve) => {
				release = resolve;
			});
			return Response.json({ message: { content: "Cancelled late result" } });
		}) as typeof fetch;
		const runtime = new Runtime(path.join(root, "work.json"), model);
		let execution: Promise<void> | undefined;
		try {
			await runtime.chat("research", "Wait", "running", "");
			execution = runtime.tick();
			await entered;
			const receipt = runtime.conversationInput.list(runtime.store)[0];
			assert.equal(receipt.status, "running");
			assert.ok(receipt.runId);
			if (receiptFailure) {
				runtime.conversationInput.stop = () => {
					throw new Error("Synthetic receipt failure");
				};
				assert.throws(
					() => runtime.stopCompanion("research"),
					/receipt failure/,
				);
			} else runtime.stopCompanion("research");
			assert.equal(activeSignal?.aborted, true);
			release();
			await execution;
			assert.equal(
				runtime.conversationInput.list(runtime.store)[0].status,
				"cancelled",
			);
			assert.equal(
				runtime.notifications.list(runtime.store.snapshot()).length,
				0,
			);
		} finally {
			release();
			await execution;
			await runtime.close();
			await fs.rm(root, { recursive: true, force: true });
		}
	});
}

for (const { stage, scoped } of [
	...[
		"accepted",
		"admitted",
		"enqueued",
		"bound",
		"claimed",
		"model-returned",
		"result-saved",
	].map((stage) => ({ stage, scoped: false })),
	{ stage: "model-returned", scoped: true },
	{ stage: "result-saved", scoped: true },
]) {
	test(`process death at ${scoped ? "Project" : "legacy"} input ${stage} never repeats completed or interrupted inference`, {
		timeout: 20000,
	}, async () => {
		const root = await temporary(),
			file = path.join(root, "work.json"),
			{ calls, model } = provider();
		let runtime: Runtime | undefined;
		try {
			if (scoped) {
				const setup = new Runtime(file);
				try {
					const { bridge, sessionId } = await context(setup, root);
					await bridge.select("research", sessionId);
				} finally {
					await setup.close();
				}
			}
			const child = fork(
				path.resolve("test/fixtures/message-crash.ts"),
				[root, stage],
				{ execArgv: ["--import", "tsx"], stdio: "ignore" },
			);
			const [code, signal] = await once(child, "exit");
			assert.equal(
				await fs.readFile(path.join(root, "checkpoint"), "utf8"),
				stage,
			);
			assert.ok(
				signal === "SIGKILL" || (process.platform === "win32" && code !== 0),
			);
			runtime = new Runtime(file, model);
			if (scoped)
				runtime.context = await ProjectContext.open(
					path.join(root, "context"),
					runtime,
				);
			await runtime.chat(
				"research",
				"Synthetic process message",
				"crash-input",
				runtime.context?.selection("research")?.sessionId ?? "",
			);
			await runtime.tick();
			await runtime.tick();
			const interrupted = ["claimed", "model-returned"].includes(stage);
			assert.equal(
				runtime.conversationInput.list(runtime.store)[0].status,
				interrupted ? "interrupted" : "result-saved",
			);
			const beforeCrash = await fs
				.readFile(path.join(root, "model-calls"), "utf8")
				.catch(() => "");
			assert.ok(beforeCrash.length + calls.length <= 1);
			if (runtime.context) {
				const target = runtime.context.selection("research");
				assert.ok(target);
				const source = await runtime.context.repository.findById(
					target.sessionId,
				);
				assert.ok(source);
				const transcript = runtime.context.repository.open(source.file);
				try {
					assert.equal(
						transcript
							.getMessages()
							.filter((message) => ["user", "assistant"].includes(message.role))
							.length,
						interrupted ? 0 : 2,
					);
				} finally {
					await transcript.close();
				}
			}
			assert.equal(runtime.store.snapshot().runs.length, 1);
			assert.equal(runtime.store.snapshot().attempts.length, 1);
		} finally {
			await runtime?.close();
			await fs.rm(root, { recursive: true, force: true });
		}
	});
}
test("changed or missing correlated stores pause execution rather than retarget or repeat input", async () => {
	for (const damage of ["work", "event", "binding"]) {
		const root = await temporary(),
			file = path.join(root, "work.json"),
			{ calls, model } = provider();
		let runtime = new Runtime(file, model);
		try {
			await runtime.chat("research", "Original", "integrity", "");
			runtime.conversationInput.reconcile(runtime.store);
			await runtime.close();
			const target = damage === "work" ? file : `${file}.messages.json`;
			const saved = JSON.parse(await fs.readFile(target, "utf8"));
			if (damage === "work") saved.runs[0].payload.prompt = "Changed";
			else if (damage === "event") {
				saved.events = [];
				saved.deliveries = [];
				saved.data.admissions = {};
			} else saved.data.admissions["message:integrity"].runId = "wrong-run";
			await fs.writeFile(target, JSON.stringify(saved));
			runtime = new Runtime(file, model);
			await runtime.tick();
			assert.match(
				String(runtime.store.snapshot().data.messageError),
				/inspection/,
			);
			assert.equal(calls.length, 0);
		} finally {
			await runtime.close();
			await fs.rm(root, { recursive: true, force: true });
		}
	}
});

test("unmarked legacy message-like fields remain application data and never enter the adapter", async () => {
	const root = await temporary(),
		{ model, calls } = provider();
	const runtime = new Runtime(path.join(root, "work.json"), model);
	try {
		runtime.store.enqueue("legacy-input-like", {
			botId: "research",
			kind: "chat",
			prompt: "Legacy synthetic input",
			nestMessageId: "unclassified",
			scope: { folder: "", page: "" },
			selection: { provider: "ollama", model: "gemma4:12b" },
		});
		await runtime.tick();
		assert.equal(runtime.store.snapshot().runs[0].status, "succeeded");
		assert.equal(calls.length, 1);
		assert.equal(runtime.conversationInput.list(runtime.store).length, 0);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
