import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Runtime } from "../src/runtime";
import { captureWriting, manuscriptNames } from "../src/writing";

test("verified manuscript baselines, profile isolation, retries and restart", async () => {
	const root = await fs.realpath(
		await fs.mkdtemp(path.join(os.tmpdir(), "nest-writing-")),
	);
	const folder = path.join(root, "manuscripts");
	await fs.mkdir(folder);
	await fs.writeFile(
		path.join(folder, "chapter.adoc"),
		"= A synthetic chapter\n\nA traveler reaches the harbor.\n",
	);
	await fs.writeFile(
		path.join(folder, "notes.md"),
		"# Synthetic notes\nClarify the destination.\n",
	);
	const requests: { messages: { role: string; content: string }[] }[] = [];
	let fail = false;
	const model = (async (_url: unknown, init?: RequestInit) => {
		requests.push(JSON.parse(String(init?.body)));
		return fail
			? new Response("synthetic failure", { status: 503 })
			: Response.json({
					message: {
						content:
							"chapter.adoc: Clarify the traveler's goal; this is a suggestion.",
					},
				});
	}) as typeof fetch;
	let runtime = new Runtime(path.join(root, "state.json"), model);
	try {
		const original = runtime.bot("research");
		runtime.save({
			...runtime.bot("documents"),
			name: "Ada",
			personality: "Patient editor",
			tone: "Precise",
			memory: "Keep the author's voice",
		});
		assert.deepEqual(runtime.bot("research"), original);
		assert.throws(
			() =>
				runtime.save({
					...runtime.bot("documents"),
					profileRevision: 0,
					name: "Stale",
				}),
			/changed while/,
		);
		runtime.grantFolder("documents", folder);
		await runtime.selectFiles("documents", ["chapter.adoc", "notes.md"]);
		const first = runtime.submit(
			"documents",
			"Review the opening",
			"first",
			"writing-review",
		);
		await runtime.tick();
		const firstRun = runtime.store.snapshot().runs.find((r) => r.id === first);
		assert.ok(firstRun);
		assert.equal(firstRun.status, "succeeded");
		assert.match(firstRun.result ?? "", /initial|baseline/i);
		assert.match(
			requests[0].messages[0].content,
			/Ada.*Patient editor.*Precise.*Keep the author's voice/s,
		);
		assert.equal(
			runtime.submit(
				"documents",
				"Review the opening",
				"first",
				"writing-review",
			),
			first,
		);
		assert.equal(runtime.store.snapshot().runs.length, 1);
		await runtime.close();
		runtime = new Runtime(path.join(root, "state.json"), model);
		await fs.writeFile(
			path.join(folder, "chapter.adoc"),
			"= A synthetic chapter\n\nA traveler reaches the harbor to find her sister.\n",
		);
		fail = true;
		const failed = runtime.submit(
			"documents",
			"Review changes",
			"failed",
			"writing-review",
		);
		await runtime.tick();
		assert.equal(
			runtime.store.snapshot().runs.find((r) => r.id === failed)?.status,
			"failed",
		);
		fail = false;
		const next = runtime.submit(
			"documents",
			"Review changes",
			"next",
			"writing-review",
		);
		await runtime.tick();
		const capture = (
			runtime.store.snapshot().data.writingEvidence as Record<
				string,
				{ baselineRunId: string; comparison: string }
			>
		)[next];
		assert.equal(capture.baselineRunId, first);
		assert.match(capture.comparison, /changed/);
		const chat = runtime.submit(
			"research",
			"Help plan a chapter",
			"chat",
			"chat",
		);
		await runtime.tick();
		assert.equal(
			runtime.store.snapshot().runs.find((r) => r.id === chat)?.status,
			"succeeded",
		);
		assert.doesNotMatch(
			requests
				.at(-1)
				?.messages.map((m) => m.content)
				.join("\n") ?? "",
			/Keep the author's voice|reaches the harbor/,
		);
		const weather = runtime.submit(
			"documents",
			"明日の天気は？",
			"weather",
			"chat",
		);
		await runtime.tick();
		assert.match(
			runtime.store.snapshot().runs.find((r) => r.id === weather)?.result ?? "",
			/Live weather lookup is not available/,
		);
		assert.throws(
			() => runtime.submit("research", "Check page", "no-page", "summary"),
			/No public page selected/,
		);
		runtime.remember(chat);
		runtime.save({ ...runtime.bot("research"), memory: "New manual memory" });
		const proposal = runtime.store
			.snapshot()
			.runs.find((r) => r.status === "approval");
		assert.ok(proposal);
		runtime.store.approve(proposal.id, true);
		await runtime.tick();
		assert.equal(runtime.bot("research").memory, "New manual memory");
		assert.match(
			runtime.store.snapshot().runs.find((r) => r.id === proposal.id)?.result ??
				"",
			/Memory changed/,
		);
		runtime.remember(chat);
		assert.equal(
			runtime.store.snapshot().runs.filter((r) => r.status === "approval")
				.length,
			1,
		);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("explicit file scope rejects traversal and symlinks, records missing and bounded coverage", async () => {
	const root = await fs.realpath(
		await fs.mkdtemp(path.join(os.tmpdir(), "nest-scope-")),
	);
	try {
		await fs.writeFile(path.join(root, "chapter.md"), "x".repeat(20000));
		await fs.symlink(
			path.join(root, "chapter.md"),
			path.join(root, "link.adoc"),
		);
		assert.deepEqual(await manuscriptNames(root), ["chapter.md"]);
		await assert.rejects(
			captureWriting("documents", root, ["../chapter.md"]),
			/filename|manuscript/i,
		);
		await assert.rejects(captureWriting("documents", root, ["link.adoc"]));
		const capture = await captureWriting("documents", root, ["chapter.md"]);
		assert.ok(capture.omittedCharacters > 0);
		await fs.rm(path.join(root, "chapter.md"));
		await fs.writeFile(
			path.join(root, "second.adoc"),
			"= Second\nSynthetic manuscript",
		);
		const missing = await captureWriting("documents", root, [
			"chapter.md",
			"second.adoc",
		]);
		assert.equal(
			missing.files.find((f) => f.name === "chapter.md")?.missing,
			true,
		);
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("revoking manuscript scope cancels inference and cannot commit a baseline", async () => {
	const root = await fs.realpath(
		await fs.mkdtemp(path.join(os.tmpdir(), "nest-cancel-")),
	);
	await fs.writeFile(
		path.join(root, "chapter.adoc"),
		"= Synthetic manuscript\nNo private data.",
	);
	let entered: () => void = () => {};
	const started = new Promise<void>((resolve) => {
		entered = resolve;
	});
	const model = (async (_url: unknown, init?: RequestInit) => {
		entered();
		await new Promise<void>((_resolve, reject) =>
			init?.signal?.addEventListener(
				"abort",
				() => reject(new Error("aborted")),
				{ once: true },
			),
		);
		return Response.json({ message: { content: "Must never be committed" } });
	}) as typeof fetch;
	const runtime = new Runtime(path.join(root, "state.json"), model);
	try {
		runtime.grantFolder("documents", root);
		await runtime.selectFiles("documents", ["chapter.adoc"]);
		const id = runtime.submit(
			"documents",
			"Review",
			"cancel-review",
			"writing-review",
		);
		const tick = runtime.tick();
		await started;
		runtime.grantFolder("documents", "");
		await tick;
		assert.equal(
			runtime.store.snapshot().runs.find((r) => r.id === id)?.status,
			"cancelled",
		);
		assert.equal(
			runtime.store.snapshot().runs.filter((r) => r.status === "succeeded")
				.length,
			0,
		);
		await assert.rejects(
			captureWriting(
				"documents",
				root,
				["chapter.adoc"],
				undefined,
				AbortSignal.abort(),
			),
		);
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
