import fs from "node:fs/promises";
import { createHash } from "node:crypto";
const provenance = JSON.parse(
	await fs.readFile("vendor/core-provenance.json", "utf8"),
);
if (
	!/^[a-f0-9]{40}$/.test(provenance.sourceCommit) ||
	provenance.archive !==
		`orbit-core-${provenance.sourceCommit.slice(0, 12)}.tgz`
)
	throw Error("Invalid pinned source identity");
const bytes = await fs.readFile(`vendor/${provenance.archive}`);
if (createHash("sha256").update(bytes).digest("hex") !== provenance.sha256)
	throw Error("Core archive checksum mismatch");
const lock = JSON.parse(await fs.readFile("package-lock.json", "utf8"));
const dependency = lock.packages["node_modules/@cybergarage/orbit"];
if (
	dependency.resolved !== `file:vendor/${provenance.archive}` ||
	dependency.integrity !==
		`sha512-${createHash("sha512").update(bytes).digest("base64")}`
)
	throw Error("Core lockfile identity or integrity mismatch");
if (process.argv.includes("--installed")) {
	const module = await fs.readFile(
		"node_modules/@cybergarage/orbit/dist/core/execution/scheduled-work.js",
	);
	if (
		createHash("sha256").update(module).digest("hex") !==
		provenance.moduleSha256
	)
		throw Error("Installed scheduler differs from pinned source");
	for (const [file, key] of [
		["dist/core/models/adapters/apple.js", "appleAdapterSha256"],
		["native/apple-foundation-models/main.swift", "appleSourceSha256"],
	]) {
		const bytes = await fs.readFile(`node_modules/@cybergarage/orbit/${file}`);
		if (createHash("sha256").update(bytes).digest("hex") !== provenance[key])
			throw Error("Installed Apple provider/source differs from pinned core");
	}
}
console.log(`Verified local Orbit package from ${provenance.sourceCommit}`);
