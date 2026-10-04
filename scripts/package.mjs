import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { packager } from "@electron/packager";
const bundle = await fs.readFile("dist/main.cjs", "utf8");
if (
	/node_modules\/(braces|micromatch|fast-glob|openai|@anthropic-ai)\//.test(
		bundle,
	)
)
	throw Error("Unrelated glob tooling leaked into the desktop runtime");
const extraResource = [];
if (process.env.NEST_INCLUDE_APPLE === "1") {
	const info = JSON.parse(
		await fs.readFile("dist/native/apple-helper-provenance.json", "utf8"),
	);
	const pin = JSON.parse(
		await fs.readFile("vendor/core-provenance.json", "utf8"),
	);
	const binary = await fs.readFile("dist/native/orbit-apple-helper");
	if (
		info.sourceCommit !== pin.sourceCommit ||
		info.sourceSha256 !== pin.appleSourceSha256 ||
		createHash("sha256").update(binary).digest("hex") !== info.binarySha256
	)
		throw Error("Optional Apple helper provenance does not match pinned core");
	extraResource.push(
		"dist/native/orbit-apple-helper",
		"dist/native/apple-helper-provenance.json",
	);
}
const paths = await packager({
	dir: ".",
	name: "Orbit Nest",
	platform: "darwin",
	arch: "arm64",
	out: "release",
	overwrite: true,
	prune: false,
	extraResource,
	ignore:
		/^\/(node_modules|vendor|test|test-results|evidence|\.git|dist\/native)(\/|$)/,
});
console.log(`Unsigned arm64 package: ${paths.join(", ")}`);
