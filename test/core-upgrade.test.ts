import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Runtime } from "../src/runtime";

const payload = (prompt: string) => ({
	kind: "chat",
	botId: "research",
	prompt,
	scope: { folder: "", page: "" },
});

test("host uses atomic core priority selection and preserves aging across restart", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-priority-"));
	const file = path.join(root, "work.json");
	let calls = 0;
	const model = (async () => {
		calls++;
		return Response.json({ message: { content: "Synthetic local response" } });
	}) as typeof fetch;
	let runtime = new Runtime(file, model);
	try {
		const low = runtime.store.enqueue(
			"low",
			payload("Low"),
			"read",
			undefined,
			{
				priority: "low",
			},
		);
		for (let index = 0; index < 8; index++) {
			const high = runtime.store.enqueue(
				`high-${index}`,
				payload("High"),
				"read",
				undefined,
				{
					priority: "high",
				},
			);
			await runtime.tick();
			assert.equal(
				runtime.store.snapshot().runs.find((run) => run.id === high)?.status,
				"succeeded",
			);
			assert.equal(
				runtime.store.snapshot().runs.find((run) => run.id === low)?.status,
				"queued",
			);
			await runtime.close();
			runtime = new Runtime(file, model);
		}
		const later = runtime.store.enqueue(
			"later-high",
			payload("Later"),
			"read",
			undefined,
			{ priority: "high" },
		);
		await runtime.tick();
		const snapshot = runtime.store.snapshot();
		assert.equal(
			snapshot.runs.find((run) => run.id === low)?.status,
			"succeeded",
		);
		assert.equal(
			snapshot.runs.find((run) => run.id === later)?.status,
			"queued",
		);
		assert.equal(snapshot.attempts.length, 9);
		assert.equal(calls, 9);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("host imports legacy work without replaying opaque effects or losing application data", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-legacy-"));
	const file = path.join(root, "legacy.json");
	let calls = 0;
	const model = (async () => {
		calls++;
		throw Error("No model call authorized");
	}) as typeof fetch;
	let runtime = new Runtime(file, model);
	try {
		const completed = runtime.store.enqueue("completed", payload("Done"));
		const done = runtime.store.claim(completed);
		runtime.store.finish(
			completed,
			done.id,
			"succeeded",
			"Synthetic saved result",
		);
		const cancelled = runtime.store.enqueue("cancelled", payload("Cancel"));
		runtime.store.cancel(cancelled);
		const queued = runtime.store.enqueue("__proto__", payload("Queued"));
		const approval = runtime.store.enqueue(
			"approval",
			{ kind: "memory", botId: "research" },
			"opaque",
			"Inspect before applying",
		);
		const opaque = runtime.store.enqueue(
			"opaque",
			{ kind: "memory", botId: "research" },
			"opaque",
		);
		runtime.store.claim(opaque);
		runtime.store.setData("cancel:legacy", { marker: "preserved" });
		// Public v1 snapshots are also the legacy on-disk shape, without event fields.
		const legacy = runtime.store.snapshot();
		await runtime.close();
		await fs.writeFile(file, JSON.stringify(legacy));
		runtime = new Runtime(file, model);
		await runtime.tick();
		const recovered = runtime.store.snapshot();
		assert.equal(recovered.version, 1);
		assert.equal(
			recovered.runs.find((run) => run.id === opaque)?.status,
			"unknown",
		);
		assert.equal(
			recovered.runs.find((run) => run.id === queued)?.status,
			"queued",
		);
		assert.equal(
			recovered.runs.find((run) => run.id === approval)?.status,
			"approval",
		);
		assert.equal(
			recovered.runs.find((run) => run.id === completed)?.result,
			"Synthetic saved result",
		);
		assert.equal(
			recovered.runs.find((run) => run.id === cancelled)?.status,
			"cancelled",
		);
		assert.deepEqual(recovered.data["cancel:legacy"], { marker: "preserved" });
		assert.deepEqual(
			recovered.runs.map((run) => run.id),
			legacy.runs.map((run) => run.id),
		);
		assert.equal(recovered.attempts.length, legacy.attempts.length);
		assert.equal(calls, 0);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("payload priority cannot select execution ahead of older default work", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-default-order-"));
	const runtime = new Runtime(path.join(root, "work.json"), (async () =>
		Response.json({
			message: { content: "Synthetic reply" },
		})) as typeof fetch);
	try {
		const first = runtime.store.enqueue("first", payload("First"));
		const second = runtime.store.enqueue("second", {
			...payload("Second"),
			priority: "high",
		});
		await runtime.tick();
		assert.equal(
			runtime.store.snapshot().runs.find((run) => run.id === first)?.status,
			"succeeded",
		);
		assert.equal(
			runtime.store.snapshot().runs.find((run) => run.id === second)?.status,
			"queued",
		);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
