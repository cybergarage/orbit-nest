import fs from "node:fs/promises";
import { packager } from "@electron/packager";
const bundle = await fs.readFile("dist/main.cjs", "utf8");
if (/node_modules\/(braces|micromatch|fast-glob)\//.test(bundle))
	throw Error("Unrelated glob tooling leaked into the desktop runtime");
const paths = await packager({
	dir: ".",
	name: "Orbit Nest",
	platform: "darwin",
	arch: "arm64",
	out: "release",
	overwrite: true,
	prune: false,
	ignore: /^\/(node_modules|vendor|test|test-results|evidence|\.git)(\/|$)/,
});
console.log(`Unsigned arm64 package: ${paths.join(", ")}`);
