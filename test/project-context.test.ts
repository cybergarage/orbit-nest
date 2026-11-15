import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Runtime } from "../src/runtime";
import { ProjectContext } from "../src/project-context";
import {
	coordinationPaths,
	recoverSessionWriter,
} from "@cybergarage/orbit/dist/core/session/coordination.js";
import type { ChatMessage } from "../src/models";

function contextOf(runtime: Runtime): ProjectContext {
	assert.ok(runtime.context);
	return runtime.context;
}
async function setup(checkpoint?: Parameters<typeof ProjectContext.open>[2]) {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-context-"));
	const requests: ChatMessage[][] = [];
	const model = (async (_url, init) => {
		const request = JSON.parse(String(init?.body));
		requests.push(request.messages);
		return Response.json({
			message: { content: `Synthetic reply ${requests.length}` },
		});
	}) as typeof fetch;
	const runtime = new Runtime(path.join(root, "work.json"), model);
	runtime.context = await ProjectContext.open(
		path.join(root, "context"),
		runtime,
		checkpoint,
	);
	return { root, runtime, requests, model };
}
async function conversation(runtime: Runtime, name: string) {
	const context = contextOf(runtime);
	const projectId = randomUUID(),
		sessionId = randomUUID();
	await context.createProject("research", name, projectId);
	await context.createSession("research", projectId, `${name} chat`, sessionId);
	return { projectId, sessionId };
}

test("one Bot keeps Project, Session and legacy history and memory isolated across restart", async () => {
	const fixture = await setup();
	let { runtime } = fixture;
	try {
		runtime.save({ ...runtime.bot("research"), memory: "LEGACY_PRIVATE_NOTE" });
		await runtime.chat("research", "LEGACY_CHAT", "legacy");
		await runtime.tick();
		const a = await conversation(runtime, "A"),
			b = await conversation(runtime, "B");
		await contextOf(runtime).select("research", a.sessionId);
		await contextOf(runtime).addMemory(
			"research",
			"A_PRIVATE_NOTE",
			randomUUID(),
			a.sessionId,
		);
		const preview = runtime.preview("research", "A_PRIVATE_CHAT", "chat");
		assert.match(preview.scope, /A \/ A chat/);
		assert.match(
			preview.action,
			/Legacy Bot memory and other conversations are excluded/,
		);
		await runtime.chat("research", "A_PRIVATE_CHAT", "a-one");
		await contextOf(runtime).select("research", b.sessionId);
		await contextOf(runtime).addMemory(
			"research",
			"B_PRIVATE_NOTE",
			randomUUID(),
			b.sessionId,
		);
		await runtime.tick(); // The queued job still targets A after UI selection changes.
		const requestA = JSON.stringify(fixture.requests.at(-1));
		assert.match(requestA, /A_PRIVATE_NOTE/);
		assert.doesNotMatch(
			requestA,
			/B_PRIVATE_NOTE|LEGACY_PRIVATE_NOTE|LEGACY_CHAT/,
		);
		await runtime.chat("research", "B_PRIVATE_CHAT", "b-one");
		await runtime.tick();
		assert.doesNotMatch(
			JSON.stringify(fixture.requests.at(-1)),
			/A_PRIVATE_NOTE|A_PRIVATE_CHAT|LEGACY_PRIVATE_NOTE|LEGACY_CHAT/,
		);
		await runtime.close();
		runtime = new Runtime(path.join(fixture.root, "work.json"), fixture.model);
		runtime.context = await ProjectContext.open(
			path.join(fixture.root, "context"),
			runtime,
		);
		assert.equal(runtime.context.selection("research")?.sessionId, b.sessionId);
		const notices = runtime.notifications.list(runtime.store.snapshot());
		const noticeA = notices.find((n) => n.target?.sessionId === a.sessionId);
		assert.ok(noticeA);
		assert.equal(noticeA.target?.projectId, a.projectId);
		await assert.rejects(
			runtime.readNotification(noticeA.id, "research", a.sessionId),
			/conversation changed/,
		);
		await assert.rejects(
			runtime.readNotification(noticeA.id, "research", b.sessionId),
			/target/,
		);
		await runtime.context.select("research", a.sessionId);
		await runtime.readNotification(noticeA.id, "research", a.sessionId);
		await runtime.readNotification(noticeA.id, "research", a.sessionId);
		assert.equal(
			runtime.notifications
				.list(runtime.store.snapshot())
				.find((n) => n.id === noticeA.id)?.read,
			true,
		);
		await runtime.chat("research", "Continue A", "a-two");
		await runtime.tick();
		assert.match(JSON.stringify(fixture.requests.at(-1)), /A_PRIVATE_CHAT/);
		assert.doesNotMatch(
			JSON.stringify(fixture.requests.at(-1)),
			/B_PRIVATE_CHAT|B_PRIVATE_NOTE|LEGACY_CHAT/,
		);
		const secondSession = randomUUID();
		await runtime.context.createSession(
			"research",
			a.projectId,
			"Separate A conversation",
			secondSession,
		);
		await runtime.context.select("research", secondSession);
		await runtime.chat("research", "New conversation", "a-separate");
		await runtime.tick();
		assert.match(JSON.stringify(fixture.requests.at(-1)), /A_PRIVATE_NOTE/);
		assert.doesNotMatch(
			JSON.stringify(fixture.requests.at(-1)),
			/A_PRIVATE_CHAT|Continue A/,
		);
		await assert.rejects(
			runtime.chat("research", "Stale UI", "stale-ui", a.sessionId),
			/context changed/,
		);
		await runtime.context.select("research", "");
		await runtime.chat("research", "Legacy again", "legacy-again");
		await runtime.tick();
		assert.match(
			JSON.stringify(fixture.requests.at(-1)),
			/LEGACY_CHAT|LEGACY_PRIVATE_NOTE/,
		);
		assert.doesNotMatch(
			JSON.stringify(fixture.requests.at(-1)),
			/A_PRIVATE_CHAT|B_PRIVATE_CHAT|A_PRIVATE_NOTE|B_PRIVATE_NOTE/,
		);
	} finally {
		await runtime.close();
		await fs.rm(fixture.root, { recursive: true, force: true });
	}
});

test("creation retries retain one Project and Session and reject changed operation inputs", async () => {
	const { runtime, root } = await setup();
	try {
		const p = randomUUID(),
			s = randomUUID();
		await contextOf(runtime).createProject("research", "A", p);
		await contextOf(runtime).createProject("research", "A", p);
		await assert.rejects(
			contextOf(runtime).createProject("research", "Changed", p),
			/reused/,
		);
		await contextOf(runtime).createSession("research", p, "A chat", s);
		await contextOf(runtime).createSession("research", p, "A chat", s);
		const view = await contextOf(runtime).view("research");
		assert.equal(view.projects.length, 1);
		assert.equal(view.sessions.length, 1);
		assert.equal(
			contextOf(runtime).repository.getTitle(view.sessions[0].sessionId).title,
			"A chat",
		);
		await assert.rejects(
			contextOf(runtime).select("documents", s),
			/not associated/,
		);
		await contextOf(runtime).select("research", s);
		assert.throws(
			() => runtime.submit("research", "Read sources", "no-sources", "summary"),
			/local chat only/,
		);
		assert.equal(runtime.store.snapshot().runs.length, 0);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("changed membership rejects a queued target before any model call", async () => {
	const { runtime, root, requests } = await setup();
	try {
		const a = await conversation(runtime, "A"),
			b = await conversation(runtime, "B");
		await contextOf(runtime).select("research", a.sessionId);
		await runtime.chat("research", "Queued for A", "queued");
		await contextOf(runtime).projects.changeMembership(a.sessionId, {
			sourceProjectId: a.projectId,
			projectId: b.projectId,
			expectedRevision: 1,
			operationId: randomUUID(),
		});
		await runtime.tick();
		assert.equal(requests.length, 0);
		assert.equal(runtime.store.snapshot().runs[0].status, "failed");
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});

for (const failureStage of ["result-saved", "transcript-saved"] as const) {
	test(`saved results survive restart after ${failureStage} without a second model call or transcript pair`, async () => {
		let fail = true;
		const fixture = await setup(async (stage) => {
			if (fail && stage === failureStage) {
				fail = false;
				throw Error("Synthetic interrupted projection");
			}
		});
		let { runtime } = fixture;
		try {
			const a = await conversation(runtime, "A");
			await contextOf(runtime).select("research", a.sessionId);
			await runtime.chat("research", "Project request", "request");
			await runtime.tick();
			assert.equal(runtime.store.snapshot().runs[0].status, "succeeded");
			assert.equal(fixture.requests.length, 1);
			assert.match(
				String(runtime.store.snapshot().data.contextRecoveryError),
				/Synthetic/,
			);
			await runtime.close();
			runtime = new Runtime(
				path.join(fixture.root, "work.json"),
				fixture.model,
			);
			runtime.context = await ProjectContext.open(
				path.join(fixture.root, "context"),
				runtime,
			);
			await runtime.tick();
			await runtime.tick();
			assert.equal(fixture.requests.length, 1);
			assert.equal(runtime.store.snapshot().attempts.length, 1);
			assert.equal(
				runtime.notifications.list(runtime.store.snapshot()).length,
				1,
			);
			const source = await runtime.context.repository.findById(a.sessionId);
			assert.ok(source);
			const session = runtime.context.repository.open(source.file);
			try {
				const messages = session
					.getMessages()
					.filter((m) => ["user", "assistant"].includes(m.role));
				assert.equal(messages.length, 2);
				assert.equal(new Set(messages.map((m) => m.id)).size, 2);
			} finally {
				await session.close();
			}
		} finally {
			await runtime.close();
			await fs.rm(fixture.root, { recursive: true, force: true });
		}
	});
}

test("an interrupted committed Session reservation resumes with the same ID", async () => {
	let interrupt = true;
	const fixture = await setup(async (stage) => {
		if (stage === "session-created" && interrupt) {
			interrupt = false;
			throw Error("Synthetic association interruption");
		}
	});
	let { runtime } = fixture;
	try {
		const p = randomUUID(),
			s = randomUUID();
		await contextOf(runtime).createProject("research", "A", p);
		await assert.rejects(
			contextOf(runtime).createSession("research", p, "A chat", s),
			/interruption/,
		);
		await runtime.close();
		runtime = new Runtime(path.join(fixture.root, "work.json"), fixture.model);
		runtime.context = await ProjectContext.open(
			path.join(fixture.root, "context"),
			runtime,
		);
		const view = await runtime.context.view("research");
		assert.equal(view.sessions.length, 1);
		assert.equal(view.sessions[0].sessionId, s);
		assert.equal(
			(await runtime.context.projects.listSessions(p)).data.length,
			1,
		);
	} finally {
		await runtime.close();
		await fs.rm(fixture.root, { recursive: true, force: true });
	}
});

test("a retained Session guard blocks projection and remains unchanged until proven offline recovery", async () => {
	let fail = true;
	const fixture = await setup(async (stage) => {
		if (stage === "result-saved" && fail) {
			fail = false;
			throw Error("Synthetic projection pause");
		}
	});
	let { runtime } = fixture;
	try {
		const a = await conversation(runtime, "A");
		await contextOf(runtime).select("research", a.sessionId);
		await runtime.chat(
			"research",
			"Saved before a guard obstruction",
			"guarded",
		);
		await runtime.tick();
		const repository = contextOf(runtime).repository;
		const guard = coordinationPaths(repository.scope(a.sessionId)).guard;
		await fs.writeFile(guard, "synthetic retained guard evidence", {
			flag: "wx",
		});
		await runtime.tick();
		assert.match(
			String(runtime.store.snapshot().data.contextRecoveryError),
			/guard/i,
		);
		assert.equal(
			await fs.readFile(guard, "utf8"),
			"synthetic retained guard evidence",
		);
		assert.equal(fixture.requests.length, 1);
		await runtime.close();
		// No other writer or restarter exists in this exclusively controlled fixture.
		recoverSessionWriter(repository.scope(a.sessionId), {
			allWritersStopped: true,
			automaticRestartersDisabled: true,
			exclusiveStorageControl: true,
		});
		runtime = new Runtime(path.join(fixture.root, "work.json"), fixture.model);
		runtime.context = await ProjectContext.open(
			path.join(fixture.root, "context"),
			runtime,
		);
		await runtime.tick();
		assert.equal(fixture.requests.length, 1);
		assert.equal(runtime.store.snapshot().data.contextRecoveryError ?? "", "");
	} finally {
		await runtime.close();
		await fs.rm(fixture.root, { recursive: true, force: true });
	}
});

for (const action of ["cancel", "change-memory"] as const) {
	test(`active Project work rejects membership moves and cannot commit after ${action}`, async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-context-race-"));
		let release = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		let announce = () => {};
		const entered = new Promise<void>((resolve) => {
			announce = resolve;
		});
		const runtime = new Runtime(path.join(root, "work.json"), (async () => {
			announce();
			await gate;
			return Response.json({ message: { content: "Stale synthetic result" } });
		}) as typeof fetch);
		let work: Promise<void> | undefined;
		try {
			runtime.context = await ProjectContext.open(
				path.join(root, "context"),
				runtime,
			);
			const a = await conversation(runtime, "A"),
				b = await conversation(runtime, "B");
			await runtime.context.select("research", a.sessionId);
			await runtime.chat("research", "Run while state changes", "active");
			const run = runtime.store.snapshot().runs[0];
			work = runtime.tick();
			await entered;
			await assert.rejects(
				runtime.context.projects.changeMembership(a.sessionId, {
					expectedRevision: 1,
					operationId: randomUUID(),
					projectId: b.projectId,
					sourceProjectId: a.projectId,
				}),
				/idle/,
			);
			if (action === "cancel") runtime.cancel(run.id);
			else
				await runtime.context.addMemory(
					"research",
					"A newly corrected Project note",
					randomUUID(),
					a.sessionId,
				);
			release();
			await work;
			assert.equal(
				runtime.store.snapshot().runs[0].status,
				action === "cancel" ? "cancelled" : "failed",
			);
			const source = await runtime.context.repository.findById(a.sessionId);
			assert.ok(source);
			const session = runtime.context.repository.open(source.file);
			try {
				assert.equal(
					session.getMessages().filter((m) => m.role !== "system").length,
					0,
				);
			} finally {
				await session.close();
			}
		} finally {
			release();
			await work;
			await runtime.close();
			await fs.rm(root, { recursive: true, force: true });
		}
	});
}

test("an applied receipt cannot hide a missing transcript pair or authorize another model call", async () => {
	const { runtime, root, requests } = await setup();
	try {
		const a = await conversation(runtime, "A");
		await contextOf(runtime).select("research", a.sessionId);
		await runtime.chat("research", "Original request", "original");
		await runtime.tick();
		assert.equal(requests.length, 1);
		const source = await contextOf(runtime).repository.findById(a.sessionId);
		assert.ok(source);
		const bytes = await fs.readFile(source.file, "utf8");
		// Deliberate synthetic corruption: retain a valid header, remove known messages.
		await fs.writeFile(source.file, `${bytes.split("\n")[0]}\n`);
		await runtime.chat("research", "Should not use incomplete history", "next");
		await runtime.tick();
		assert.equal(requests.length, 1);
		assert.equal(runtime.store.snapshot().runs.at(-1)?.status, "failed");
		assert.match(
			runtime.store.snapshot().runs.at(-1)?.result ?? "",
			/missing or changed/,
		);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("legacy payload context values do not activate new routing or projection", async () => {
	const { runtime, root, requests } = await setup();
	try {
		const a = await conversation(runtime, "A");
		await contextOf(runtime).select("research", a.sessionId);
		await contextOf(runtime).addMemory(
			"research",
			"PROJECT_ONLY_NOTE",
			randomUUID(),
			a.sessionId,
		);
		runtime.store.enqueue("legacy-with-context", {
			kind: "chat",
			botId: "research",
			prompt: "Legacy application data",
			context: contextOf(runtime).selection("research"),
			scope: { folder: "", page: "" },
		});
		await runtime.tick();
		assert.equal(runtime.store.snapshot().runs[0].status, "succeeded");
		assert.doesNotMatch(JSON.stringify(requests[0]), /PROJECT_ONLY_NOTE/);
		const source = await contextOf(runtime).repository.findById(a.sessionId);
		assert.ok(source);
		const session = contextOf(runtime).repository.open(source.file);
		try {
			assert.equal(
				session
					.getMessages()
					.filter((m) => m.role === "user" || m.role === "assistant").length,
				0,
			);
		} finally {
			await session.close();
		}
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("changed membership cannot retarget or read an originating Project notification", async () => {
	const { runtime, root, requests } = await setup();
	try {
		const a = await conversation(runtime, "A");
		const b = await conversation(runtime, "B");
		await contextOf(runtime).select("research", a.sessionId);
		await runtime.chat(
			"research",
			"Keep original attribution",
			"original-notice",
		);
		await runtime.tick();
		const notice = runtime.notifications.list(runtime.store.snapshot())[0];
		await contextOf(runtime).projects.changeMembership(a.sessionId, {
			sourceProjectId: a.projectId,
			projectId: b.projectId,
			expectedRevision: 1,
			operationId: randomUUID(),
		});
		await assert.rejects(
			runtime.readNotification(notice.id, "research", a.sessionId),
			/membership changed/,
		);
		await runtime.tick();
		const retained = runtime.notifications.list(runtime.store.snapshot())[0];
		assert.equal(retained.target?.projectId, a.projectId);
		assert.equal(retained.read, false);
		assert.equal(requests.length, 1);
		assert.equal(runtime.store.snapshot().attempts.length, 1);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
