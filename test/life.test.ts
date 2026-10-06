import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { emptyLife, remaining, updateLife } from "../src/life";
import { Runtime } from "../src/runtime";

test("focus rewards are bounded, replay-safe, survive absence and never complete agent work", async () => {
	let state = emptyLife();
	let event = 0;
	const now = Date.UTC(2026, 9, 6, 12);
	const act = (action: string, extra = {}, time = now) => {
		const input = {
			action,
			eventId: `event-${event++}`,
			revision: state.revision,
			...extra,
		};
		state = updateLife(state, input, time);
		return input;
	};
	act("nurturing", { enabled: true });
	const start = act("start", { step: "Write one transition" });
	assert.equal(
		remaining(
			state.session as NonNullable<typeof state.session>,
			now + 26 * 60_000,
		),
		0,
	);
	assert.equal(state.session?.status, "active");
	assert.deepEqual(updateLife(state, start, now + 26 * 60_000), state);
	act("pause", {}, now + 1000);
	assert.equal(
		remaining(
			state.session as NonNullable<typeof state.session>,
			now + 5 * 60_000,
		),
		25 * 60_000 - 1000,
	);
	act("resume", {}, now + 5 * 60_000);
	act("close", { progress: "Taking a break", nextStep: "Reread tomorrow" });
	act("start", { step: "Another start" });
	act("close", { progress: "", nextStep: "" });
	assert.equal(state.decorations.length, 2);
	assert.equal(state.awards.length, 2);
	act("start", { step: "Return later" }, now - 86400_000);
	act("close", { progress: "", nextStep: "" }, now - 86400_000);
	assert.equal(state.decorations.length, 2);
	act("start", { step: "Return much later" }, now + 7 * 86400_000);
	assert.equal(state.decorations.length, 3);
	assert.equal(state.history?.[0].nextStep, "Reread tomorrow");
	assert.throws(
		() =>
			updateLife(state, {
				action: "nurturing",
				eventId: "stale",
				revision: 0,
				enabled: false,
			}),
		/changed/,
	);
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-life-"));
	try {
		let runtime = new Runtime(path.join(root, "work.json"));
		assert.equal(runtime.bot("moku").template, "moku");
		const before = runtime.store.snapshot();
		const legacyBot = runtime.bot("documents");
		const id = runtime.addBot({ template: "moku", requestId: "moku-create" });
		assert.equal(
			runtime.addBot({ template: "moku", requestId: "moku-create" }),
			id,
		);
		assert.equal(
			runtime.bots().length,
			(before.data.bots as unknown[]).length + 1,
		);
		assert.throws(
			() => runtime.addBot({ template: ["moku"], requestId: "invalid-create" }),
			/Invalid/,
		);
		assert.equal(runtime.bot(id).model, "");
		assert.equal(runtime.bot(id).memory, "");
		const writer = runtime.addBot({
			template: "writing",
			requestId: "writer-create",
		});
		await fs.writeFile(
			path.join(root, "synthetic.md"),
			"# Synthetic manuscript",
		);
		runtime.grantFolder(writer, await fs.realpath(root));
		await runtime.selectFiles(writer, ["synthetic.md"]);
		assert.deepEqual(runtime.bot(writer).selectedFiles, ["synthetic.md"]);
		assert.equal(runtime.bot("documents").folder, legacyBot.folder);
		assert.throws(() => runtime.grantFolder(id, root), /capability/);
		assert.throws(
			() => runtime.save({ ...runtime.bot(id), page: "https://example.com" }),
			/capability/,
		);
		runtime.updateLife(id, {
			action: "start",
			eventId: "start",
			revision: 0,
			step: "Synthetic step",
		});
		assert.deepEqual(runtime.store.snapshot().runs, before.runs);
		await runtime.close();
		runtime = new Runtime(path.join(root, "work.json"));
		assert.equal(runtime.life(id).session?.step, "Synthetic step");
		assert.deepEqual(runtime.bot("documents"), legacyBot);
		assert.throws(
			() => runtime.updateLife("documents", { action: "start" }),
			/only/,
		);
		await runtime.close();
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
});
