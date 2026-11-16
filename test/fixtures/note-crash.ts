import fs from "node:fs";
import path from "node:path";
import { Runtime } from "../../src/runtime";
import { ProjectContext } from "../../src/project-context";
const [root] = process.argv.slice(2);
const runtime = new Runtime(path.join(root, "work.json"));
runtime.context = await ProjectContext.open(
	path.join(root, "context"),
	runtime,
	async (stage, id) => {
		if (stage === "note-saved") {
			fs.writeFileSync(path.join(root, "checkpoint"), id);
			process.kill(process.pid, "SIGKILL");
		}
	},
);
await runtime.context.changeMemory(
	"research",
	JSON.parse(fs.readFileSync(path.join(root, "note-input.json"), "utf8")),
);
throw new Error("Expected note checkpoint was not reached");
