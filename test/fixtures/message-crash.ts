import fs from "node:fs";
import path from "node:path";
import { ProjectContext } from "../../src/project-context";
import { Runtime } from "../../src/runtime";
const [root, failure] = process.argv.slice(2);
const checkpoint = (stage: string) => {
	if (stage === failure) {
		fs.writeFileSync(path.join(root, "checkpoint"), stage);
		process.kill(process.pid, "SIGKILL");
	}
};
const runtime = new Runtime(
	path.join(root, "work.json"),
	(async () => {
		fs.appendFileSync(path.join(root, "model-calls"), "1");
		return Response.json({ message: { content: "Synthetic process result" } });
	}) as typeof fetch,
	undefined,
	undefined,
	checkpoint,
	checkpoint,
);
if (fs.existsSync(path.join(root, "context", "projects.sqlite")))
	runtime.context = await ProjectContext.open(
		path.join(root, "context"),
		runtime,
	);
await runtime.chat(
	"research",
	"Synthetic process message",
	"crash-input",
	runtime.context?.selection("research")?.sessionId ?? "",
);
await runtime.tick();
throw new Error("Expected input checkpoint was not reached");
