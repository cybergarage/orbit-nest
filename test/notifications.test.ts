import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { once } from "node:events";
import { fork } from "node:child_process";
import { Runtime } from "../src/runtime";
import { ResultNotifications } from "../src/notifications";

for (const stage of ["accepted", "delivered"] as const) {
	test(`notification interruption after ${stage} recovers one receipt without executing work`, async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-notice-"));
		let calls = 0;
		const model = (async () => {
			calls++;
			return Response.json({ message: { content: "Synthetic saved result" } });
		}) as typeof fetch;
		let runtime = new Runtime(path.join(root, "work.json"), model);
		let inbox: ResultNotifications | undefined;
		try {
			await runtime.chat("research", "Synthetic request", "one");
			await runtime.tick();
			const work = runtime.store.snapshot();
			inbox = new ResultNotifications(
				path.join(root, "inbox.json"),
				(value) => {
					if (value === stage)
						throw new Error("Synthetic delivery interruption");
				},
			);
			assert.throws(() => inbox?.reconcile(work), /interruption/);
			assert.equal(inbox.list(work).length, 1);
			assert.equal(
				inbox.list(work)[0].delivery,
				stage === "accepted" ? "pending" : "delivered",
			);
			inbox.close();
			inbox = new ResultNotifications(path.join(root, "inbox.json"));
			inbox.reconcile(work);
			inbox.reconcile(work);
			const notice = inbox.list(work)[0];
			assert.equal(inbox.list(work).length, 1);
			assert.equal(notice.read, false);
			assert.throws(
				() => inbox?.read(work, notice.id, "documents", ""),
				/target/,
			);
			inbox.read(work, notice.id, "research", "");
			inbox.read(work, notice.id, "research", "");
			inbox.close();
			inbox = new ResultNotifications(path.join(root, "inbox.json"));
			inbox.reconcile(work);
			assert.equal(inbox.list(work)[0].read, true);
			const changed = structuredClone(work);
			changed.runs[0].result = "Changed synthetic result";
			assert.throws(() => inbox?.reconcile(changed), /Conflicting event/);
			assert.throws(() => inbox?.list(changed), /source changed/);
			await runtime.close();
			runtime = new Runtime(path.join(root, "work.json"), model);
			await runtime.tick();
			assert.equal(calls, 1);
			assert.equal(runtime.store.snapshot().attempts.length, 1);
		} finally {
			inbox?.close();
			await runtime.close();
			await fs.rm(root, { recursive: true, force: true });
		}
	});
}

test("cancelled and approval-waiting work never becomes a successful-result notification", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-notice-cancel-"));
	let release = () => {};
	let announce = () => {};
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const entered = new Promise<void>((resolve) => {
		announce = resolve;
	});
	const runtime = new Runtime(path.join(root, "work.json"), (async () => {
		announce();
		await gate;
		return Response.json({ message: { content: "Stale output" } });
	}) as typeof fetch);
	let work: Promise<void> | undefined;
	try {
		await runtime.chat("research", "Cancel me", "cancel");
		work = runtime.tick();
		await entered;
		runtime.cancel(runtime.store.snapshot().runs[0].id);
		release();
		await work;
		runtime.store.enqueue(
			"approval",
			{ kind: "memory", botId: "research" },
			"opaque",
			"Confirmation required",
		);
		await runtime.tick();
		assert.deepEqual(runtime.notifications.list(runtime.store.snapshot()), []);
		assert.deepEqual(
			runtime.store.snapshot().runs.map((r) => r.status),
			["cancelled", "approval"],
		);
	} finally {
		release();
		await work;
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});

for (const stage of ["accepted", "delivered"] as const) {
	test(`process death after notification ${stage} retains one durable receipt`, async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-notice-death-"));
		const runtime = new Runtime(path.join(root, "work.json"));
		let inbox: ResultNotifications | undefined;
		try {
			await runtime.chat(
				"research",
				"What is today's weather?",
				"synthetic-no-inference",
			);
			await runtime.tick();
			const work = runtime.store.snapshot();
			await runtime.close();
			const child = fork("test/fixtures/notification-crash.ts", [root, stage], {
				execArgv: ["--import", "tsx"],
				stdio: "ignore",
			});
			const [code, signal] = await once(child, "exit");
			assert.equal(
				await fs.readFile(path.join(root, "checkpoint"), "utf8"),
				stage,
			);
			// Windows reports forced self-termination as a nonzero code, without a POSIX signal.
			if (process.platform === "win32") assert.notEqual(code, 0);
			else assert.equal(signal, "SIGKILL");
			const persisted = JSON.parse(
				await fs.readFile(path.join(root, "crash-inbox.json"), "utf8"),
			);
			assert.equal(persisted.events.length, 1);
			assert.equal(
				persisted.deliveries[0].status,
				stage === "accepted" ? "pending" : "acknowledged",
			);
			inbox = new ResultNotifications(path.join(root, "crash-inbox.json"));
			inbox.reconcile(work);
			inbox.reconcile(work);
			assert.equal(inbox.list(work).length, 1);
			assert.equal(inbox.list(work)[0].delivery, "delivered");
			assert.equal(inbox.list(work)[0].read, false);
		} finally {
			inbox?.close();
			await runtime.close();
			await fs.rm(root, { recursive: true, force: true });
		}
	});
}

test("notification delivery failure stays separate from successful execution and retry", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-notice-failure-"));
	let calls = 0;
	const runtime = new Runtime(path.join(root, "work.json"), (async () => {
		calls++;
		return Response.json({
			message: { content: "Saved despite delivery failure" },
		});
	}) as typeof fetch);
	try {
		const reconcile = runtime.notifications.reconcile.bind(
			runtime.notifications,
		);
		runtime.notifications.reconcile = () => {
			throw new Error("Synthetic notification failure");
		};
		await runtime.chat("research", "Save before notification", "one");
		await runtime.tick();
		assert.equal(runtime.store.snapshot().runs[0].status, "succeeded");
		assert.match(
			String(runtime.store.snapshot().data.notificationError),
			/Synthetic/,
		);
		runtime.notifications.reconcile = reconcile;
		await runtime.tick();
		assert.equal(runtime.store.snapshot().data.notificationError, "");
		assert.equal(
			runtime.notifications.list(runtime.store.snapshot()).length,
			1,
		);
		assert.equal(calls, 1);
		assert.equal(runtime.store.snapshot().attempts.length, 1);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
