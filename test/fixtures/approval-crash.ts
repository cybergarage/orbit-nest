import fs from "node:fs";
import path from "node:path";
import { Runtime } from "../../src/runtime";
const [root, stage] = process.argv.slice(2);
const runtime = new Runtime(
	path.join(root, "work.json"),
	undefined,
	undefined,
	(value) => {
		if (value === stage) {
			fs.writeFileSync(path.join(root, "checkpoint"), value);
			process.kill(process.pid, "SIGKILL");
		}
	},
);
runtime.answerApproval(
	JSON.parse(fs.readFileSync(path.join(root, "input.json"), "utf8")),
);
throw new Error("Expected approval checkpoint was not reached");
