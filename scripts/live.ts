import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Runtime } from "../src/runtime";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-live-"));
const folder = path.join(root, "documents");
await fs.mkdir(folder);
await fs.writeFile(
	path.join(folder, "meeting.md"),
	"# Synthetic meeting\nThe team meets Friday at noon to review the garden plan. Bring a draft agenda. No real people or private information.",
);
const runtime = new Runtime(path.join(root, "work.json"));
runtime.grantFolder("documents", await fs.realpath(folder));
runtime.submit(
	"documents",
	"Summarize this note in two sentences.",
	"live-gemma4",
);
await runtime.tick();
const run = runtime.store.snapshot().runs[0];
await fs.mkdir("evidence", { recursive: true });
await fs.writeFile(
	"evidence/live-ollama.json",
	JSON.stringify(
		{
			model: "gemma4:12b",
			status: run.status,
			result: run.result,
			date: new Date().toISOString(),
			fixture: "synthetic meeting note",
		},
		null,
		2,
	),
);
console.log(
	JSON.stringify({
		model: "gemma4:12b",
		status: run.status,
		result: run.result,
	}),
);
await runtime.close();
await fs.rm(root, { recursive: true, force: true });
if (run.status !== "succeeded") process.exitCode = 1;
