import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Runtime } from "../src/runtime";
import { companionActivity, scopeLabel, STATUS_LABELS } from "../src/workflow";

test("board state derives from persisted records, never completion wording", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-board-"));
	let runtime = new Runtime(path.join(root, "state.json"));
	try {
		const queued = runtime.store.enqueue("queued", {
			botId: "research",
			kind: "chat",
			prompt: "I completed everything",
		});
		assert.equal(
			companionActivity(runtime.store.snapshot(), "research").recentResult,
			undefined,
		);
		assert.equal(
			companionActivity(runtime.store.snapshot(), "research").active[0].status,
			"queued",
		);
		const attempt = runtime.store.claim(queued);
		assert.equal(
			companionActivity(runtime.store.snapshot(), "research").active[0].status,
			"running",
		);
		runtime.store.finish(
			queued,
			attempt.id,
			"succeeded",
			"Synthetic saved result",
		);
		assert.equal(
			companionActivity(runtime.store.snapshot(), "research").recentResult?.id,
			queued,
		);
		assert.equal(
			companionActivity(runtime.store.snapshot(), "documents").recentResult,
			undefined,
		);
		const failed = runtime.store.enqueue("failed", {
			botId: "research",
			kind: "chat",
			prompt: "Success claimed",
		});
		const failedAttempt = runtime.store.claim(failed);
		runtime.store.finish(
			failed,
			failedAttempt.id,
			"failed",
			"Done! (untrusted model wording)",
		);
		assert.equal(
			companionActivity(runtime.store.snapshot(), "research").recentResult?.id,
			queued,
		);
		await runtime.close();
		runtime = new Runtime(path.join(root, "state.json"));
		assert.equal(
			companionActivity(runtime.store.snapshot(), "research").recentResult
				?.result,
			"Synthetic saved result",
		);
		assert.deepEqual(Object.keys(STATUS_LABELS).sort(), [
			"approval",
			"cancelled",
			"failed",
			"queued",
			"running",
			"succeeded",
			"unknown",
		]);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("previews are unsubmitted, scope-bound and invalidated by saved profile changes", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-preview-"));
	const runtime = new Runtime(path.join(root, "state.json"));
	try {
		const preview = runtime.preview(
			"research",
			"Help outline a chapter",
			"chat",
		);
		assert.equal(runtime.store.snapshot().runs.length, 0);
		assert.match(preview.scope, /no new source/);
		runtime.checkPreview(
			"research",
			"Help outline a chapter",
			"chat",
			preview.token,
		);
		assert.throws(
			() =>
				runtime.checkPreview(
					"documents",
					"Help outline a chapter",
					"chat",
					preview.token,
				),
			/changed/,
		);
		assert.throws(
			() =>
				runtime.checkPreview(
					"research",
					"Different prompt",
					"chat",
					preview.token,
				),
			/changed/,
		);
		runtime.save({ ...runtime.bot("research"), tone: "Precise" });
		assert.throws(
			() =>
				runtime.checkPreview(
					"research",
					"Help outline a chapter",
					"chat",
					preview.token,
				),
			/changed/,
		);
		assert.throws(
			() => runtime.preview("research", "Check page", "summary"),
			/No public page/,
		);
		runtime.save({ ...runtime.bot("research"), page: "https://example.com/" });
		const page = runtime.preview("research", "Check page", "summary");
		assert.equal(page.scope, "https://example.com/");
		assert.match(page.limits, /Read-only/);
		assert.equal(runtime.store.snapshot().runs.length, 0);
		assert.equal(
			scopeLabel({ kind: "memory" }),
			"This Companion's local memory only",
		);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("owned stop pauses only owned routines; opaque interrupted work stays unknown across restart", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-stop-"));
	let runtime = new Runtime(path.join(root, "state.json"));
	try {
		runtime.schedule("research", "Outline", 1, "chat");
		runtime.schedule("documents", "Review ideas", 1, "chat");
		const read = runtime.store.enqueue("read", {
			botId: "research",
			kind: "chat",
		});
		const other = runtime.store.enqueue("other", {
			botId: "documents",
			kind: "chat",
		});
		const opaque = runtime.store.enqueue(
			"opaque",
			{ botId: "research", kind: "memory" },
			"opaque",
		);
		runtime.store.claim(read);
		runtime.store.claim(opaque);
		const approval = runtime.store.enqueue(
			"approval",
			{ botId: "research", kind: "memory" },
			"opaque",
			"Synthetic memory proposal",
		);
		runtime.stopCompanion("research");
		runtime.stopCompanion("research");
		let state = runtime.store.snapshot();
		assert.equal(state.runs.find((r) => r.id === read)?.status, "cancelled");
		assert.equal(state.runs.find((r) => r.id === opaque)?.status, "unknown");
		assert.equal(
			state.runs.find((r) => r.id === approval)?.status,
			"cancelled",
		);
		assert.equal(state.runs.find((r) => r.id === other)?.status, "queued");
		assert.equal(state.schedules[0].paused, true);
		assert.equal(state.schedules[1].paused, false);
		await runtime.close();
		runtime = new Runtime(path.join(root, "state.json"));
		state = runtime.store.snapshot();
		assert.equal(state.runs.find((r) => r.id === opaque)?.status, "unknown");
		assert.equal(state.schedules[0].paused, true);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("offline model produces a persisted failure, not a completed receipt; empty task creates no work", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-offline-"));
	const offline = (async () => {
		throw Error("synthetic offline model");
	}) as typeof fetch;
	const runtime = new Runtime(path.join(root, "state.json"), offline);
	try {
		assert.throws(
			() => runtime.preview("research", "", "chat"),
			/Enter a task/,
		);
		assert.equal(runtime.store.snapshot().runs.length, 0);
		const preview = runtime.preview(
			"research",
			"Explain a synthetic chapter",
			"chat",
		);
		runtime.checkPreview("research", preview.prompt, "chat", preview.token);
		const id = runtime.submit(
			"research",
			preview.prompt,
			"offline-request",
			"chat",
		);
		assert.equal(
			runtime.submit("research", preview.prompt, "offline-request", "chat"),
			id,
		);
		await runtime.tick();
		assert.equal(runtime.store.snapshot().runs.length, 1);
		assert.equal(runtime.store.snapshot().runs[0].status, "failed");
		assert.match(
			runtime.store.snapshot().runs[0].result ?? "",
			/Ollama.*No cloud fallback/s,
		);
		assert.equal(
			companionActivity(runtime.store.snapshot(), "research").recentResult,
			undefined,
		);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
