import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fork } from "node:child_process";
import { once } from "node:events";
import test from "node:test";
import { Runtime } from "../src/runtime";
import { ProjectContext } from "../src/project-context";
for (const stage of [
	"result-saved",
	"user-message-saved",
	"transcript-saved",
] as const) {
	test(`process death after ${stage} uses core ownership recovery and never repeats inference`, {
		timeout: 20000,
	}, async () => {
		const root = await fs.mkdtemp(
			path.join(os.tmpdir(), "nest-context-crash-"),
		);
		const file = path.join(root, "work.json"),
			contextRoot = path.join(root, "context");
		let calls = 0;
		const forbiddenModel = (async () => {
			calls++;
			throw Error("No replay authorized");
		}) as typeof fetch;
		let runtime = new Runtime(file, forbiddenModel);
		const projectId = randomUUID(),
			sessionId = randomUUID();
		try {
			runtime.context = await ProjectContext.open(contextRoot, runtime);
			await runtime.context.createProject("research", "Synthetic", projectId);
			await runtime.context.createSession(
				"research",
				projectId,
				"Synthetic conversation",
				sessionId,
			);
			await runtime.context.select("research", sessionId);
			await runtime.close();
			const child = fork("test/fixtures/context-crash.ts", [root, stage], {
				execArgv: ["--import", "tsx"],
				stdio: ["ignore", "pipe", "pipe", "ipc"],
			});
			let diagnostics = "";
			child.stderr?.on("data", (bytes) => {
				diagnostics += String(bytes);
			});
			try {
				const checkpoint = await Promise.race([
					once(child, "message"),
					once(child, "exit").then(() => {
						throw Error(
							`Crash fixture exited before checkpoint: ${diagnostics}`,
						);
					}),
				]);
				assert.equal((checkpoint[0] as { stage: string }).stage, stage);
				const stopped = once(child, "exit");
				child.kill("SIGKILL");
				await stopped;
			} finally {
				if (child.exitCode === null && child.signalCode === null) {
					const stopped = once(child, "exit");
					child.kill("SIGKILL");
					await stopped;
				}
			}
			runtime = new Runtime(file, forbiddenModel);
			runtime.context = await ProjectContext.open(contextRoot, runtime);
			await runtime.tick();
			assert.equal(calls, 0);
			assert.equal(runtime.store.snapshot().runs[0].status, "succeeded");
			assert.equal(
				runtime.store.snapshot().data.contextRecoveryError ?? "",
				"",
			);
			await runtime.tick();
			assert.equal(calls, 0);
			assert.equal(runtime.store.snapshot().attempts.length, 1);
			const source = await runtime.context.repository.findById(sessionId);
			assert.ok(source);
			const session = runtime.context.repository.open(source.file);
			try {
				assert.equal(
					session
						.getMessages()
						.filter((m) => m.role === "user" || m.role === "assistant").length,
					2,
				);
			} finally {
				await session.close();
			}
		} finally {
			await runtime.close();
			await fs.rm(root, { recursive: true, force: true });
		}
	});
}
