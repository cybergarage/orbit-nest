import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Runtime } from "../src/runtime";
import type { WritingCapture } from "../src/writing";
const root = await fs.realpath(
	await fs.mkdtemp(path.join(os.tmpdir(), "nest-writing-live-")),
);
const file = path.join(root, "work.json");
const folder = path.join(root, "manuscripts");
await fs.mkdir(folder);
await fs.writeFile(
	path.join(folder, "harbor.adoc"),
	"= The Harbor\n\nMira reaches the harbor. The fog hides the boats. She asks the keeper for help.\n",
);
await fs.writeFile(
	path.join(folder, "revision.md"),
	"# Author notes\nPreserve a calm voice. Clarify why Mira needs help.\n",
);
let runtime = new Runtime(file);
const evidence: unknown[] = [];
try {
	runtime.save({
		...runtime.bot("documents"),
		name: "Harbor editor",
		personality: "A careful supportive editor",
		tone: "Concise and specific",
	});
	runtime.grantFolder("documents", folder);
	await runtime.selectFiles("documents", ["harbor.adoc", "revision.md"]);
	const first = runtime.submit(
		"documents",
		"Give two concrete next revision points with filenames. Do not invent earlier drafts.",
		"live-writing-first",
		"writing-review",
	);
	await runtime.tick();
	let state = runtime.store.snapshot();
	const initial = state.runs.find((r) => r.id === first);
	assert.equal(initial?.status, "succeeded");
	evidence.push(initial);
	await runtime.close();
	runtime = new Runtime(file);
	await fs.writeFile(
		path.join(folder, "harbor.adoc"),
		"= The Harbor\n\nMira reaches the harbor to find her missing sister. The fog hides the boats. She asks the keeper which boat arrived at dawn.\n",
	);
	const next = runtime.submit(
		"documents",
		"Explain the verified change, then give two next revision points with filenames.",
		"live-writing-next",
		"writing-review",
	);
	await runtime.tick();
	state = runtime.store.snapshot();
	const updated = state.runs.find((r) => r.id === next);
	assert.equal(updated?.status, "succeeded");
	assert.equal(
		(state.data.writingEvidence as Record<string, WritingCapture>)[next]
			.baselineRunId,
		first,
	);
	assert.equal(
		runtime.submit(
			"documents",
			"Explain the verified change, then give two next revision points with filenames.",
			"live-writing-next",
			"writing-review",
		),
		next,
	);
	assert.equal(state.runs.filter((r) => r.status === "succeeded").length, 2);
	evidence.push(updated);
	await fs.mkdir("evidence", { recursive: true });
	await fs.writeFile(
		"evidence/writing-live.json",
		JSON.stringify(
			{
				host: "mac-mini-m4",
				model: "gemma4:12b",
				date: new Date().toISOString(),
				fixture: "synthetic manuscripts",
				restart: true,
				visibleResults: 2,
				runs: evidence,
			},
			null,
			2,
		),
	);
	console.log(
		JSON.stringify({
			model: "gemma4:12b",
			restart: true,
			visibleResults: 2,
			results: evidence,
		}),
	);
} finally {
	await runtime.close();
	await fs.rm(root, { recursive: true, force: true });
}
