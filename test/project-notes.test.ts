import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { fork } from "node:child_process";
import { once } from "node:events";
import { SyntheticRuntime as Runtime } from "./ollama-fixture";
import { ProjectContext } from "../src/project-context";
import type { NoteChange } from "../src/project-notes";

async function setup(checkpoint?: Parameters<typeof ProjectContext.open>[2]) {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-notes-"));
	const runtime = new Runtime(path.join(root, "work.json"));
	const context = await ProjectContext.open(
		path.join(root, "context"),
		runtime,
		checkpoint,
	);
	runtime.context = context;
	const projectId = randomUUID(),
		sessionId = randomUUID();
	await context.createProject("research", "Synthetic Alpha", projectId);
	await context.createSession(
		"research",
		projectId,
		"Alpha conversation",
		sessionId,
	);
	await context.select("research", sessionId);
	await context.addMemory(
		"research",
		"Original Alpha note",
		randomUUID(),
		sessionId,
	);
	return { root, runtime, context, projectId, sessionId };
}
async function change(
	context: ProjectContext,
	body: string,
	action: NoteChange["action"] = "correct",
): Promise<NoteChange> {
	const view = await context.view("research");
	assert.ok(view.target);
	assert.ok(view.preview);
	const note = [...view.notes, ...view.inactive][0];
	assert.ok(note);
	return {
		target: view.target,
		generation: view.preview.generation,
		noteId: note.id,
		expectedRevision: note.revision,
		operationId: randomUUID(),
		action,
		body,
	};
}
async function cleanup(fixture: Awaited<ReturnType<typeof setup>>) {
	await fixture.runtime.close();
	await fs.rm(fixture.root, { recursive: true, force: true });
}

test("correction and non-destructive deactivation are revisioned, idempotent and restored after restart", async () => {
	const fixture = await setup();
	let { runtime, context } = fixture;
	try {
		const first = await change(context, "Corrected Alpha note");
		await context.changeMemory("research", first);
		await context.changeMemory("research", first);
		let view = await context.view("research");
		assert.equal(view.notes[0].revision, 2);
		assert.equal(view.preview?.generation, 2);
		const latest = await change(context, "Newest Alpha note");
		await context.changeMemory("research", latest);
		await context.changeMemory("research", first);
		await assert.rejects(
			context.changeMemory("research", {
				...first,
				body: "Conflicting old operation",
			}),
			/conflict|changed/i,
		);
		view = await context.view("research");
		assert.equal(view.notes[0].body, "Newest Alpha note");
		assert.equal(view.notes[0].revision, 3);
		const retire = await change(context, "Newest Alpha note", "deactivate");
		await context.changeMemory("research", retire);
		await context.changeMemory("research", retire);
		view = await context.view("research");
		assert.equal(view.notes.length, 0);
		assert.equal(view.inactive[0].id, first.noteId);
		assert.equal(view.inactive[0].body, "Newest Alpha note");
		assert.equal(view.inactive[0].revision, 4);
		assert.equal(view.preview?.entries.length, 0);
		assert.doesNotMatch(view.preview?.rendered ?? "", /Newest/);
		const inactiveCorrection = await change(context, "Corrected inactive note");
		await context.changeMemory("research", inactiveCorrection);
		await runtime.close();
		runtime = new Runtime(path.join(fixture.root, "work.json"));
		context = await ProjectContext.open(
			path.join(fixture.root, "context"),
			runtime,
		);
		runtime.context = context;
		await context.changeMemory("research", inactiveCorrection);
		view = await context.view("research");
		assert.equal(view.inactive[0].retired, true);
		assert.equal(view.inactive[0].body, "Corrected inactive note");
		assert.equal(view.preview?.generation, 5);
		assert.equal(view.notes.length, 0);
	} finally {
		await runtime.close();
		await fs.rm(fixture.root, { recursive: true, force: true });
	}
});

test("concurrent edits and stale generations/revisions cannot overwrite a newer note", async () => {
	const fixture = await setup();
	const { context } = fixture;
	try {
		const input = await change(context, "Concurrent winner");
		const results = await Promise.allSettled([
			context.changeMemory("research", input),
			context.changeMemory("research", {
				...input,
				operationId: randomUUID(),
				body: "Concurrent loser",
			}),
		]);
		assert.equal(
			results.filter((result) => result.status === "fulfilled").length,
			1,
		);
		const view = await context.view("research");
		assert.ok(view.preview);
		assert.equal(view.notes[0].body, "Concurrent winner");
		await assert.rejects(
			context.changeMemory("research", {
				...input,
				operationId: randomUUID(),
				body: "Stale generation",
			}),
			/changed/,
		);
		await assert.rejects(
			context.changeMemory("research", {
				...input,
				generation: view.preview.generation,
				operationId: randomUUID(),
				body: "Stale revision",
			}),
			/conflict|changed/i,
		);
		await assert.rejects(
			context.changeMemory("research", {
				...input,
				generation: view.preview.generation,
				operationId: randomUUID(),
				body: "界".repeat(3000),
			}),
			/8 KiB/,
		);
		assert.equal((await context.view("research")).notes[0].revision, 2);
	} finally {
		await cleanup(fixture);
	}
});

test("Project/Session/Bot switches and changed membership never retarget a note write or history read", async () => {
	const fixture = await setup();
	const { context, projectId, sessionId } = fixture;
	try {
		const original = await change(context, "Wrong destination");
		const otherProject = randomUUID(),
			otherSession = randomUUID(),
			sibling = randomUUID();
		await context.createProject("research", "Synthetic Beta", otherProject);
		await context.createSession(
			"research",
			otherProject,
			"Beta conversation",
			otherSession,
		);
		await context.createSession(
			"research",
			projectId,
			"Alpha sibling",
			sibling,
		);
		await context.select("research", otherSession);
		await context.addMemory(
			"research",
			"Beta private note",
			randomUUID(),
			otherSession,
		);
		await assert.rejects(
			context.changeMemory("research", original),
			/target changed/,
		);
		await assert.rejects(
			context.noteHistory("research", original.target),
			/target changed/,
		);
		assert.equal(
			(await context.view("research")).notes[0].body,
			"Beta private note",
		);
		await context.select("research", sibling);
		await assert.rejects(
			context.changeMemory("research", original),
			/target changed/,
		);
		assert.equal(
			(await context.view("research")).notes[0].body,
			"Original Alpha note",
		);
		await context.select("research", sessionId);
		await assert.rejects(
			context.changeMemory("documents", original),
			/target changed/,
		);
		await context.projects.changeMembership(sessionId, {
			sourceProjectId: projectId,
			projectId: otherProject,
			expectedRevision: 1,
			operationId: randomUUID(),
		});
		await assert.rejects(
			context.changeMemory("research", original),
			/membership changed/,
		);
		const unavailable = await context.view("research");
		assert.match(unavailable.noteError ?? "", /membership changed/);
		assert.equal(unavailable.notes.length, 0);
		assert.equal(unavailable.preview, undefined);
	} finally {
		await cleanup(fixture);
	}
});

test("inspection reports exact bounded inclusion/exclusions without capturing a run or enabling extraction", async () => {
	const fixture = await setup();
	const { context, runtime, projectId, sessionId } = fixture;
	try {
		const oversizedId = randomUUID();
		for (let index = 0; index < 17; index++)
			await context.addMemory(
				"research",
				`Synthetic short note ${index}`,
				randomUUID(),
				sessionId,
			);
		await context.addMemory(
			"research",
			" x".repeat(3900),
			oversizedId,
			sessionId,
		);
		const before = await context.projects.store.query({
			kind: "project",
			id: projectId,
		});
		const view = await context.view("research"),
			repeated = await context.view("research");
		assert.ok(view.preview);
		assert.equal(view.preview.entries.length, 16);
		assert.ok(view.preview.tokens <= 2048);
		assert.ok(
			view.preview.exclusions.some(
				(entry) => entry.id === oversizedId && entry.reason === "token-budget",
			),
		);
		assert.ok(
			view.preview.exclusions.some((entry) => entry.reason === "entry-limit"),
		);
		assert.equal(view.preview.digest, repeated.preview?.digest);
		assert.equal(
			await context.projects.store.query({
				kind: "operation",
				id: view.preview.captureId,
			}),
			null,
		);
		assert.equal(
			(await context.projects.store.query({ kind: "project", id: projectId }))
				?.memoryGeneration,
			before?.memoryGeneration,
		);
		assert.equal(runtime.store.snapshot().runs.length, 0);
		assert.equal(
			await context.projects.store.query({ kind: "automation", id: projectId }),
			null,
		);
	} finally {
		await cleanup(fixture);
	}
});

test("inactive note history is bounded, repeatable and retained without deletion", async () => {
	const fixture = await setup();
	const { context, sessionId } = fixture;
	try {
		for (let index = 0; index < 51; index++) {
			const input = await change(
				context,
				(await context.view("research")).notes[0].body,
				"deactivate",
			);
			await context.changeMemory("research", input);
			if (index < 50)
				await context.addMemory(
					"research",
					`Inactive fixture ${index}`,
					randomUUID(),
					sessionId,
				);
		}
		const first = await context.view("research");
		assert.ok(first.target);
		assert.ok(first.inactiveNext);
		assert.equal(first.inactive.length, 50);
		assert.equal(first.preview?.entries.length, 0);
		const second = await context.noteHistory(
			"research",
			first.target,
			first.inactiveNext,
		);
		assert.equal(second.notes.length, 1);
		assert.equal(second.next, undefined);
		assert.equal(
			new Set([...first.inactive, ...second.notes].map((note) => note.id)).size,
			51,
		);
		const repeat = await context.noteHistory(
			"research",
			first.target,
			first.inactiveNext,
		);
		assert.deepEqual(second, repeat);
	} finally {
		await cleanup(fixture);
	}
});

for (const action of ["correct", "deactivate"] as const) {
	test(`process death after ${action} commit retains one mutation on retry`, {
		timeout: 20000,
	}, async () => {
		const fixture = await setup();
		let { runtime, context } = fixture;
		try {
			const input = await change(
				context,
				action === "correct" ? "Durable correction" : "Original Alpha note",
				action,
			);
			await fs.writeFile(
				path.join(fixture.root, "note-input.json"),
				JSON.stringify(input),
			);
			await runtime.close();
			const child = fork(
				path.resolve("test/fixtures/note-crash.ts"),
				[fixture.root],
				{ execArgv: ["--import", "tsx"], stdio: "ignore" },
			);
			const [code, signal] = await once(child, "exit");
			assert.equal(
				await fs.readFile(path.join(fixture.root, "checkpoint"), "utf8"),
				input.noteId,
			);
			assert.ok(
				signal === "SIGKILL" || (process.platform === "win32" && code !== 0),
			);
			runtime = new Runtime(path.join(fixture.root, "work.json"));
			context = await ProjectContext.open(
				path.join(fixture.root, "context"),
				runtime,
			);
			runtime.context = context;
			await context.changeMemory("research", input);
			const view = await context.view("research"),
				note = [...view.notes, ...view.inactive][0];
			assert.equal(note.revision, 2);
			assert.equal(note.retired, action === "deactivate");
			assert.equal(view.preview?.generation, 2);
		} finally {
			await runtime.close();
			await fs.rm(fixture.root, { recursive: true, force: true });
		}
	});
}

for (const action of ["correct", "deactivate"] as const) {
	test(`${action} during inference prevents an old-generation result and never rewrites notes`, async () => {
		const fixture = await setup();
		const { runtime } = fixture;
		let release = () => {},
			enter = () => {};
		const entered = new Promise<void>((resolve) => {
			enter = resolve;
		});
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		let execution: Promise<void> | undefined;
		try {
			// Inject the bounded local provider used by Runtime, without any real inference.
			await runtime.close();
			const running = new Runtime(
				path.join(fixture.root, "work.json"),
				(async () => {
					enter();
					await gate;
					return Response.json({ message: { content: "Stale model result" } });
				}) as typeof fetch,
			);
			fixture.runtime = running;
			running.context = await ProjectContext.open(
				path.join(fixture.root, "context"),
				running,
			);
			const bridge = running.context;
			await running.chat(
				"research",
				"Synthetic generation request",
				`generation-${action}`,
				fixture.sessionId,
			);
			execution = running.tick();
			await entered;
			const input = await change(
				bridge,
				action === "correct" ? "New generation note" : "Original Alpha note",
				action,
			);
			await bridge.changeMemory("research", input);
			release();
			await execution;
			const state = running.store.snapshot();
			assert.equal(state.runs[0].status, "failed");
			assert.match(state.runs[0].result ?? "", /memory changed/);
			assert.equal(state.data.contextEvidence, undefined);
			const view = await bridge.view("research");
			assert.equal(view.preview?.generation, 2);
			const note = [...view.notes, ...view.inactive][0];
			assert.equal(note.body, input.body);
			assert.equal(note.retired, action === "deactivate");
			assert.equal(running.notifications.list(state).length, 0);
			assert.equal(
				running.conversationInput.list(running.store)[0].status,
				"failed",
			);
		} finally {
			release();
			await execution;
			await cleanup(fixture);
		}
	});
}

test("guarded creation rejects stale input and admits exact concurrent retries once", async () => {
	const fixture = await setup();
	const { context, sessionId } = fixture;
	try {
		const view = await context.view("research");
		assert.ok(view.target);
		assert.ok(view.preview);
		const guard = { target: view.target, generation: view.preview.generation },
			operation = randomUUID();
		await Promise.all([
			context.addMemory(
				"research",
				"Guarded new note",
				operation,
				sessionId,
				guard,
			),
			context.addMemory(
				"research",
				"Guarded new note",
				operation,
				sessionId,
				guard,
			),
		]);
		const saved = await context.view("research");
		assert.equal(saved.notes.length, 2);
		assert.equal(saved.preview?.generation, 2);
		await assert.rejects(
			context.addMemory(
				"research",
				"Changed retry",
				operation,
				sessionId,
				guard,
			),
			/conflict|changed/i,
		);
		await assert.rejects(
			context.addMemory(
				"research",
				"Stale new note",
				randomUUID(),
				sessionId,
				guard,
			),
			/changed/,
		);
		await context.select("research", "");
		await assert.rejects(
			context.addMemory(
				"research",
				"Wrong context",
				randomUUID(),
				sessionId,
				guard,
			),
			/target changed/,
		);
	} finally {
		await cleanup(fixture);
	}
});
