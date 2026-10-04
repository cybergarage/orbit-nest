import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LocalModels } from "../src/models";
import { Runtime } from "../src/runtime";
const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-apple-live-"));
const file = path.join(root, "state.json");
const models = new LocalModels(path.resolve("dist/native/orbit-apple-helper"));
const catalog = await models.catalog();
assert.equal(catalog.apple.available, true, catalog.apple.message);
let runtime = new Runtime(file, fetch, models);
try {
	runtime.save({
		...runtime.bot("research"),
		role: "Respond briefly in English and remember synthetic facts from this conversation.",
		tone: "Brief and precise",
	});
	await runtime.selectModel(
		"research",
		"apple",
		"system",
		runtime.bot("research").profileRevision,
	);
	const prompt =
		"Remember that my favorite color is cobalt. Acknowledge this in one short sentence.";
	const preview = runtime.preview("research", prompt, "chat");
	runtime.checkPreview("research", prompt, "chat", preview.token);
	const first = runtime.submit("research", prompt, "live-apple-first", "chat");
	await runtime.tick();
	const initial = runtime.store.snapshot().runs.find((r) => r.id === first);
	assert.equal(initial?.status, "succeeded");
	await runtime.close();
	runtime = new Runtime(file, fetch, models);
	const next = runtime.submit(
		"research",
		"What is my favorite color? Reply with only the color name.",
		"live-apple-next",
		"chat",
	);
	await runtime.tick();
	const second = runtime.store.snapshot().runs.find((r) => r.id === next);
	assert.equal(second?.status, "succeeded");
	assert.match(second?.result ?? "", /cobalt/i);
	assert.equal(
		runtime.submit(
			"research",
			"What is my favorite color? Reply with only the color name.",
			"live-apple-next",
			"chat",
		),
		next,
	);
	assert.throws(
		() => runtime.preview("research", "Read a public page", "summary"),
		/text chat only/,
	);
	const cancelled = runtime.submit(
		"research",
		"Write a long synthetic story about a lighthouse.",
		"live-apple-cancel",
		"chat",
	);
	const tick = runtime.tick();
	const timer = setTimeout(() => runtime.cancel(cancelled), 50);
	try {
		await tick;
	} finally {
		clearTimeout(timer);
	}
	const state = runtime.store.snapshot();
	assert.equal(state.runs.find((r) => r.id === cancelled)?.status, "cancelled");
	assert.equal(state.runs.find((r) => r.id === cancelled)?.result, undefined);
	const evidence = {
		date: new Date().toISOString(),
		provider: "apple",
		model: "system",
		execution: "local",
		fixture: "synthetic color/lighthouse text",
		availability: catalog.apple,
		restart: true,
		repeatedRequestResults: state.runs.filter((r) => r.status === "succeeded")
			.length,
		ownedCancellation: true,
		noFallback: true,
		initial,
		second,
	};
	await fs.mkdir("evidence", { recursive: true });
	await fs.writeFile(
		"evidence/apple-live.json",
		JSON.stringify(evidence, null, 2),
	);
	console.log(JSON.stringify(evidence));
} finally {
	await runtime.close();
	await fs.rm(root, { recursive: true, force: true });
}
