import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SyntheticRuntime as Runtime } from "./ollama-fixture";
import { CHARACTER_COLORS, characterColor } from "../src/appearance";

test("character appearance persists per Bot without changing active work, profile or approval authority", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-appearance-"));
	const file = path.join(root, "work.json");
	let runtime = new Runtime(file);
	try {
		const run = runtime.store.enqueue("appearance-running", {
			botId: "documents",
			prompt: "Synthetic work",
		});
		const attempt = runtime.store.claim(run);
		const result = runtime.store.enqueue("appearance-result", {
			botId: "documents",
			prompt: "Synthetic approval",
		});
		const done = runtime.store.claim(result);
		runtime.store.finish(result, done.id, "succeeded", "Synthetic memory");
		runtime.remember(result);
		const before = runtime.store.snapshot();
		const approvals = runtime.approvalRequests();
		for (const color of CHARACTER_COLORS) {
			runtime.setAppearance("documents", color);
			runtime.setAppearance("documents", color);
			assert.equal(
				characterColor(
					runtime.store.snapshot().data.botAppearance,
					"documents",
				),
				color,
			);
		}
		assert.deepEqual(runtime.store.snapshot().data.bots, before.data.bots);
		assert.deepEqual(runtime.store.snapshot().runs, before.runs);
		assert.deepEqual(runtime.store.snapshot().attempts, before.attempts);
		assert.deepEqual(runtime.approvalRequests(), approvals);
		assert.equal(
			characterColor(runtime.store.snapshot().data.botAppearance, "research"),
			"Mint",
		);
		for (const invalid of [null, "mint", "Orange", {}, 7])
			assert.throws(
				() => runtime.setAppearance("documents", invalid),
				/Invalid character color/,
			);
		assert.throws(() => runtime.setAppearance("missing", "Sky"), /Unknown/);
		// Finish the fixture before reopening; appearance must not stop its attempt.
		runtime.store.finish(
			run,
			attempt.id,
			"succeeded",
			"Synthetic retained result",
		);
		await runtime.close();
		runtime = new Runtime(file);
		assert.equal(
			characterColor(runtime.store.snapshot().data.botAppearance, "documents"),
			"Rose",
		);
		assert.deepEqual(runtime.approvalRequests(), approvals);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("switching selected conversations and colors during inference retains the original work and notification target", async () => {
	const { randomUUID } = await import("node:crypto");
	const { ProjectContext } = await import("../src/project-context");
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-character-work-"));
	let enter = () => {},
		release = () => {};
	const entered = new Promise<void>((resolve) => {
		enter = resolve;
	});
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const runtime = new Runtime(path.join(root, "work.json"), (async () => {
		enter();
		await gate;
		return Response.json({ message: { content: "Synthetic Alpha result" } });
	}) as typeof fetch);
	let execution: Promise<void> | undefined;
	try {
		const context = await ProjectContext.open(
			path.join(root, "context"),
			runtime,
		);
		runtime.context = context;
		const alpha = randomUUID(),
			beta = randomUUID(),
			a = randomUUID(),
			b = randomUUID(),
			other = randomUUID(),
			c = randomUUID();
		await context.createProject("research", "Alpha", alpha);
		await context.createProject("research", "Beta", beta);
		await context.createSession("research", alpha, "Alpha chat", a);
		await context.createSession("research", beta, "Beta chat", b);
		await context.createProject("documents", "Other Bot", other);
		await context.createSession("documents", other, "Other Bot chat", c);
		await context.select("research", a);
		await context.addMemory("research", "Alpha private note", randomUUID(), a);
		await context.select("documents", c);
		await runtime.chat(
			"research",
			"Synthetic retained target",
			"character-switch",
			a,
		);
		execution = runtime.tick();
		await entered;
		await context.select("research", b);
		runtime.setAppearance("research", "Sky");
		runtime.setAppearance("documents", "Rose");
		assert.equal(runtime.store.snapshot().runs[0].status, "running");
		release();
		await execution;
		const state = runtime.store.snapshot();
		assert.equal(state.runs[0].status, "succeeded");
		assert.equal(
			(state.runs[0].payload as { context: { sessionId: string } }).context
				.sessionId,
			a,
		);
		assert.equal((await context.view("research")).selected, b);
		assert.equal((await context.view("research")).notes.length, 0);
		assert.equal((await context.view("documents")).notes.length, 0);
		const notice = runtime.notifications.list(state)[0];
		assert.equal(notice.botId, "research");
		assert.equal(notice.target?.projectId, alpha);
		assert.equal(notice.target?.sessionId, a);
		await assert.rejects(
			runtime.readNotification(notice.id, "research", b),
			/target|conversation/i,
		);
		assert.equal(runtime.store.snapshot().attempts.length, 1);
	} finally {
		release();
		await execution;
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
