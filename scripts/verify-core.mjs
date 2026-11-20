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
		["dist/core/projects/sqlite-store.js", "projectStoreSha256"],
		["dist/core/projects/sqlite-worker.js", "projectWorkerSha256"],
		["dist/core/projects/service.js", "projectServiceSha256"],
		["dist/core/session/repository.js", "sessionRepositorySha256"],
		["dist/core/session/codec.js", "sessionCodecSha256"],
		["dist/core/projects/memory-service.js", "projectMemorySha256"],
		["dist/core/projects/memory-context.js", "memoryContextSha256"],
		["dist/core/projects/session-memory-tool.js", "sessionMemoryToolSha256"],
		["dist/core/projects/memory-search-tool.js", "memorySearchToolSha256"],
		["dist/core/agent.js", "agentSha256"],
		["dist/core/tools/builtins/index.js", "builtinFactorySha256"],
		["dist/core/models/adapters/ollama.js", "ollamaAdapterSha256"],

		["dist/core/execution/event-store.js", "eventStoreSha256"],
		["dist/core/execution/event-inbox.js", "eventInboxSha256"],
		["dist/core/execution/job-priority.js", "jobPrioritySha256"],
		["dist/core/models/adapters/apple.js", "appleAdapterSha256"],
		["native/apple-foundation-models/main.swift", "appleSourceSha256"],
	]) {
		const bytes = await fs.readFile(`node_modules/@cybergarage/orbit/${file}`);
		if (createHash("sha256").update(bytes).digest("hex") !== provenance[key])
			throw new Error(
				"Installed runtime module/source differs from pinned core",
			);
	}
}
console.log(`Verified local Orbit package from ${provenance.sourceCommit}`);
