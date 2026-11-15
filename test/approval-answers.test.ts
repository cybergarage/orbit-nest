import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fork } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { ProjectContext } from "../src/project-context";
import { Runtime } from "../src/runtime";
import type {
	ApprovalCheckpoint,
	ApprovalRequest,
} from "../src/approval-answers";

function proposal(runtime: Runtime, key = "synthetic") {
	const id = runtime.store.enqueue(key, {
		botId: "documents",
		prompt: "Synthetic note",
	});
	const attempt = runtime.store.claim(id);
	runtime.store.finish(
		id,
		attempt.id,
		"succeeded",
		"Synthetic approved memory",
	);
	runtime.remember(id);
	const request = runtime.approvalRequests().at(-1);
	assert.ok(request);
	return request;
}
for (const allow of [true, false]) {
	test(`local ${allow ? "approve" : "reject"} is durable and duplicate/conflicting receipts never repeat work`, async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-answer-"));
		const file = path.join(root, "work.json");
		let calls = 0;
		const model = (async () => {
			calls++;
			throw Error("No model expected");
		}) as typeof fetch;
		let runtime = new Runtime(file, model);
		try {
			const input = { ...proposal(runtime), allow };
			runtime.answerApproval(input);
			runtime.answerApproval(input);
			assert.throws(
				() => runtime.answerApproval({ ...input, allow: !allow }),
				/Conflicting/,
			);
			await runtime.tick();
			assert.equal(
				runtime.bot("documents").memory,
				allow ? "Synthetic approved memory" : "",
			);
			assert.equal(
				runtime.store.snapshot().runs[1].status,
				allow ? "succeeded" : "cancelled",
			);
			const attempts = runtime.store.snapshot().attempts.length;
			await runtime.close();
			runtime = new Runtime(file, model);
			runtime.answerApproval(input);
			await runtime.tick();
			assert.equal(runtime.store.snapshot().attempts.length, attempts);
			assert.equal(calls, 0);
			const events = JSON.parse(
				await fs.readFile(`${file}.answers.json`, "utf8"),
			);
			assert.equal(events.events.length, 1);
			assert.equal(events.deliveries[0].status, "acknowledged");
			assert.equal(events.data.consumed[`answer:${input.id}`], "decided");
		} finally {
			await runtime.close();
			await fs.rm(root, { recursive: true, force: true });
		}
	});
}

test("wrong Bot, conversation, action token, changed profile and cancellation reject before acceptance", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-answer-"));
	const file = path.join(root, "work.json");
	const runtime = new Runtime(file);
	try {
		const input = { ...proposal(runtime), allow: true };
		for (const changed of [
			{ botId: "research" },
			{ sessionId: "third-party-session" },
			{ token: "0".repeat(64) },
		])
			assert.throws(
				() => runtime.answerApproval({ ...input, ...changed }),
				/target|conversation/,
			);
		assert.equal(
			JSON.parse(await fs.readFile(`${file}.answers.json`, "utf8")).events
				.length,
			0,
		);
		runtime.save({
			...runtime.bot("documents"),
			tone: "Changed authority revision",
		});
		assert.throws(() => runtime.answerApproval(input), /Stale/);
		runtime.cancel(input.id);
		assert.throws(() => runtime.answerApproval(input), /pending/);
		assert.equal(runtime.bot("documents").memory, "");
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});

async function assertRecoveredOnce(
	runtime: Runtime,
	input: ApprovalRequest & { allow: boolean },
): Promise<void> {
	await runtime.tick();
	await runtime.tick();
	assert.equal(runtime.bot("documents").memory, "Synthetic approved memory");
	assert.equal(runtime.store.snapshot().attempts.length, 2);
	runtime.answerApproval(input);
	await runtime.tick();
	assert.equal(runtime.store.snapshot().attempts.length, 2);
}

for (const stage of ["accepted", "admitted", "decided", "consumed"] as const) {
	test(`interruption after ${stage} recovers without a repeated effect`, async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-answer-"));
		const file = path.join(root, "work.json");
		let runtime = new Runtime(file, undefined, undefined, (checkpoint) => {
			if (checkpoint === stage) throw Error("Synthetic interruption");
		});
		try {
			const input = { ...proposal(runtime), allow: true };
			assert.throws(() => runtime.answerApproval(input), /interruption/);
			assert.equal(runtime.bot("documents").memory, "");
			await runtime.close();
			runtime = new Runtime(file);
			await assertRecoveredOnce(runtime, input);
		} finally {
			await runtime.close();
			await fs.rm(root, { recursive: true, force: true });
		}
	});
}
for (const change of ["cancel", "profile", "unknown"] as const) {
	test(`accepted fact cannot revive ${change} work on restart`, async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-answer-"));
		const file = path.join(root, "work.json");
		let runtime = new Runtime(file, undefined, undefined, (stage) => {
			if (stage === (change === "unknown" ? "consumed" : "accepted"))
				throw Error("Synthetic interruption");
		});
		try {
			const input = { ...proposal(runtime), allow: true };
			assert.throws(() => runtime.answerApproval(input));
			if (change === "cancel") runtime.cancel(input.id);
			if (change === "profile")
				runtime.save({
					...runtime.bot("documents"),
					memory: "Human replacement",
				});
			if (change === "unknown") runtime.store.claim(input.id);
			await runtime.close();
			runtime = new Runtime(file);
			runtime.answerApproval(input);
			await runtime.tick();
			assert.equal(
				runtime.bot("documents").memory,
				change === "profile" ? "Human replacement" : "",
			);
			assert.equal(
				runtime.store.snapshot().runs[1].status,
				{ cancel: "cancelled", profile: "approval", unknown: "unknown" }[
					change
				],
			);
		} finally {
			await runtime.close();
			await fs.rm(root, { recursive: true, force: true });
		}
	});
}
for (const stage of [
	"accepted",
	"admitted",
	"decided",
	"consumed",
] as ApprovalCheckpoint[]) {
	test(`process death at approval ${stage} persists one answer and one execution`, async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-answer-crash-"));
		const file = path.join(root, "work.json");
		let runtime = new Runtime(file);
		try {
			const input = { ...proposal(runtime), allow: true };
			await fs.writeFile(path.join(root, "input.json"), JSON.stringify(input));
			await runtime.close();
			const child = fork(
				path.resolve("test/fixtures/approval-crash.ts"),
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
			runtime = new Runtime(file);
			await assertRecoveredOnce(runtime, input);
		} finally {
			await runtime.close();
			await fs.rm(root, { recursive: true, force: true });
		}
	});
}

test("selected Project and changed membership cannot authorize a legacy or scoped memory action", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-answer-context-"));
	const runtime = new Runtime(path.join(root, "work.json"));
	try {
		const input = { ...proposal(runtime), allow: true };
		const context = await ProjectContext.open(
			path.join(root, "context"),
			runtime,
		);
		runtime.context = context;
		const projectId = randomUUID(),
			other = randomUUID(),
			sessionId = randomUUID();
		await context.createProject("documents", "Synthetic A", projectId);
		await context.createProject("documents", "Synthetic B", other);
		await context.createSession(
			"documents",
			projectId,
			"Synthetic chat",
			sessionId,
		);
		await context.select("documents", sessionId);
		assert.throws(() => runtime.answerApproval(input), /conversation/);
		assert.throws(
			() => runtime.answerApproval({ ...input, sessionId }),
			/conversation/,
		);
		const target = context.selection("documents");
		assert.ok(target);
		const scoped = runtime.store.enqueue(
			"synthetic-scoped",
			{
				kind: "memory",
				botId: "documents",
				text: "No permission",
				expectedMemory: "",
				nestContextVersion: 1,
				context: target,
			},
			"opaque",
			"Synthetic unsupported scoped mutation",
		);
		assert.equal(
			runtime.approvalRequests().some((request) => request.id === scoped),
			false,
		);
		await context.projects.changeMembership(sessionId, {
			sourceProjectId: projectId,
			projectId: other,
			expectedRevision: 1,
			operationId: randomUUID(),
		});
		assert.throws(
			() => runtime.answerApproval({ ...input, id: scoped, sessionId }),
			/conversation/,
		);
		assert.equal(runtime.bot("documents").memory, "");
		assert.equal(
			JSON.parse(
				await fs.readFile(path.join(root, "work.json.answers.json"), "utf8"),
			).events.length,
			0,
		);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("corrupt consumption or changed action blocks execution instead of trusting a receipt", async () => {
	for (const changed of ["receipt", "action"]) {
		const root = await fs.mkdtemp(
			path.join(os.tmpdir(), "nest-answer-corrupt-"),
		);
		const file = path.join(root, "work.json");
		let runtime = new Runtime(file);
		try {
			const input = { ...proposal(runtime), allow: true };
			runtime.answerApproval(input);
			await runtime.close();
			const target = changed === "receipt" ? `${file}.answers.json` : file;
			const state = JSON.parse(await fs.readFile(target, "utf8"));
			if (changed === "receipt")
				state.data.consumed[`answer:${input.id}`] = "arbitrary";
			else state.runs[1].payload.text = "Changed action";
			await fs.writeFile(target, JSON.stringify(state));
			runtime = new Runtime(file);
			await runtime.tick();
			assert.match(
				String(runtime.store.snapshot().data.approvalError),
				/inspection/,
			);
			assert.equal(runtime.bot("documents").memory, "");
			assert.equal(runtime.store.snapshot().attempts.length, 1);
		} finally {
			await runtime.close();
			await fs.rm(root, { recursive: true, force: true });
		}
	}
});

test("new memory work requires consumed answer evidence and revalidates authority at execution", async () => {
	for (const mode of ["bypass", "changed-after-answer"]) {
		const root = await fs.mkdtemp(
			path.join(os.tmpdir(), "nest-answer-boundary-"),
		);
		const runtime = new Runtime(path.join(root, "work.json"));
		try {
			const input = { ...proposal(runtime), allow: true };
			if (mode === "bypass") runtime.store.approve(input.id, true);
			else {
				runtime.answerApproval(input);
				runtime.save({
					...runtime.bot("documents"),
					memory: "Later explicit human memory",
				});
			}
			await runtime.tick();
			assert.equal(
				runtime.bot("documents").memory,
				mode === "bypass" ? "" : "Later explicit human memory",
			);
			assert.equal(
				runtime.store.snapshot().runs[1].status,
				mode === "bypass" ? "queued" : "unknown",
			);
			await runtime.tick();
			assert.equal(
				runtime.store.snapshot().attempts.length,
				mode === "bypass" ? 1 : 2,
			);
		} finally {
			await runtime.close();
			await fs.rm(root, { recursive: true, force: true });
		}
	}
});

test("protected legacy pending approvals remain answerable without inventing historical facts", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-answer-legacy-"));
	const file = path.join(root, "work.json");
	let runtime = new Runtime(file);
	try {
		const id = runtime.store.enqueue(
			"legacy-memory",
			{
				kind: "memory",
				botId: "documents",
				text: "Legacy synthetic memory",
				expectedMemory: "",
			},
			"opaque",
			"Replace legacy synthetic memory",
		);
		await runtime.close();
		runtime = new Runtime(file);
		const request = runtime
			.approvalRequests()
			.find((request) => request.id === id);
		assert.ok(request);
		runtime.answerApproval({ ...request, allow: true });
		await runtime.tick();
		assert.equal(runtime.bot("documents").memory, "Legacy synthetic memory");
		const saved = await fs.readFile(`${file}.answers.json`, "utf8");
		await runtime.tick();
		runtime.answerApproval({ ...request, allow: true });
		await runtime.tick();
		assert.equal(await fs.readFile(`${file}.answers.json`, "utf8"), saved);
		assert.equal(runtime.store.snapshot().attempts.length, 1);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
