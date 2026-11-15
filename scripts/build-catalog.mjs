import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { rebuild } from "@electron/rebuild";
const require = createRequire(import.meta.url);
const stage = path.resolve("dist/catalog-native");
const electronVersion = require("electron/package.json").version;
const sqliteVersion = require("better-sqlite3/package.json").version;
const identity = {
	electronVersion,
	sqliteVersion,
	arch: process.arch,
	platform: process.platform,
};
const binary = path.join(
	stage,
	"node_modules/better-sqlite3/build/Release/better_sqlite3.node",
);
const record = path.join(stage, "provenance.json");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
try {
	const prior = JSON.parse(await fs.readFile(record, "utf8"));
	if (
		JSON.stringify(prior.identity) === JSON.stringify(identity) &&
		prior.sha256 === digest(await fs.readFile(binary))
	)
		process.exit(0);
} catch {
	/* A missing or mismatched build is rebuilt from pinned dependency sources. */
}
await fs.rm(stage, { recursive: true, force: true });
await fs.mkdir(path.join(stage, "node_modules"), { recursive: true });
await fs.writeFile(
	path.join(stage, "package.json"),
	JSON.stringify({
		private: true,
		dependencies: { "better-sqlite3": sqliteVersion },
	}),
);
// These are build inputs and runtime dependencies, not copies of user state.
for (const name of ["better-sqlite3", "bindings", "file-uri-to-path"]) {
	await fs.cp(
		path.dirname(require.resolve(`${name}/package.json`)),
		path.join(stage, "node_modules", name),
		{
			recursive: true,
			filter: (file) =>
				!file.includes(`${path.sep}build${path.sep}`) &&
				!file.endsWith(`${path.sep}build`),
		},
	);
}
await rebuild({
	buildPath: stage,
	electronVersion,
	arch: process.arch,
	onlyModules: ["better-sqlite3"],
	force: true,
	buildFromSource: true,
});
await fs.writeFile(
	record,
	`${JSON.stringify({ identity, sha256: digest(await fs.readFile(binary)) }, null, 2)}\n`,
);
