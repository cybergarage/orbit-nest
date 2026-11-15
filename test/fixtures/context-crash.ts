import path from "node:path";
import { Runtime } from "../../src/runtime";
import { ProjectContext } from "../../src/project-context";
const [root, failureStage] = process.argv.slice(2);
const runtime = new Runtime(path.join(root, "work.json"), (async () =>
	Response.json({
		message: { content: "Synthetic crash result" },
	})) as typeof fetch);
runtime.context = await ProjectContext.open(
	path.join(root, "context"),
	runtime,
	async (stage, id) => {
		if (stage === failureStage) {
			process.send?.({ stage, id });
			await new Promise<void>(() => {});
		}
	},
);
await runtime.chat("research", "Synthetic crash request", "crash-request");
await runtime.tick();
await runtime.close();
