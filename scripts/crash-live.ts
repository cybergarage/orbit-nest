import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { Runtime } from "../src/runtime";
const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-crash-live-"));
const folder = await fs.realpath(root);
await fs.writeFile(
	path.join(folder, "source.md"),
	"Synthetic garden meeting: Friday at noon. Bring an agenda.",
);
const file = path.join(root, "work.json");
let runtime = new Runtime(file);
runtime.grantFolder("documents", folder);
await runtime.selectFiles("documents", ["source.md"]);
runtime.store.schedule({
	next: Date.now(),
	effect: "read",
	payload: {
		kind: "writing-review",
		botId: "documents",
		prompt: "Summarize the synthetic note in one sentence.",
		scope: { folder, page: "", files: ["source.md"] },
	},
});
await runtime.close();
const script = `import {Runtime} from './src/runtime.ts';const r=new Runtime(${JSON.stringify(file)});await r.tick();await r.close();`;
const child = spawn(
	process.execPath,
	["--import", "tsx", "--input-type=module", "-e", script],
	{ stdio: "ignore" },
);
let killed = false;
for (let i = 0; i < 200; i++) {
	const state = JSON.parse(await fs.readFile(file, "utf8"));
	if (
		state.runs?.[0]?.status === "running" &&
		state.data?.writingEvidence?.[state.runs[0].id]
	) {
		child.kill("SIGKILL");
		killed = true;
		break;
	}
	await new Promise((resolve) => setTimeout(resolve, 20));
}
if (!killed) throw Error("Could not observe running scheduled model request");
await new Promise((resolve) => child.once("exit", resolve));
runtime = new Runtime(file);
const recovered = runtime.store.snapshot().runs[0];
await runtime.tick();
const state = runtime.store.snapshot();
await runtime.close();
const evidence = {
	date: new Date().toISOString(),
	model: "gemma4:12b",
	kill: "SIGKILL after manuscript capture during scheduled model request",
	recoveredStatus: recovered.status,
	initialBaselineAfterRecovery:
		state.runs[0].result?.includes("Initial baseline"),
	stableRequestId: state.runs[0].requestId === recovered.requestId,
	visibleResults: state.runs.filter((r) => r.status === "succeeded").length,
	attempts: state.attempts.length,
	result: state.runs[0].result,
};
await fs.writeFile(
	"evidence/crash-live.json",
	JSON.stringify(evidence, null, 2),
);
console.log(JSON.stringify(evidence));
await fs.rm(root, { recursive: true, force: true });
if (
	!evidence.initialBaselineAfterRecovery ||
	evidence.visibleResults !== 1 ||
	!evidence.stableRequestId ||
	evidence.attempts !== 2
)
	process.exitCode = 1;
