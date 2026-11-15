import fs from "node:fs";
import path from "node:path";
import { ResultNotifications } from "../../src/notifications";
const [root, stage] = process.argv.slice(2);
const inbox = new ResultNotifications(
	path.join(root, "crash-inbox.json"),
	(value) => {
		if (value === stage) {
			fs.writeFileSync(path.join(root, "checkpoint"), value);
			process.kill(process.pid, "SIGKILL");
		}
	},
);
inbox.reconcile(
	JSON.parse(fs.readFileSync(path.join(root, "work.json"), "utf8")),
);
throw new Error("Expected crash checkpoint was not reached");
