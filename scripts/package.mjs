import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { packager } from "@electron/packager";
if (process.platform !== "darwin" || !["arm64", "x64"].includes(process.arch))
	throw new Error(
		"Desktop packaging is currently supported on macOS arm64/x64 hosts only",
	);
const bundle = (
	await Promise.all(
		[
			"dist/main.cjs",
			"dist/catalog-native/context.mjs",
			"dist/catalog-native/sqlite-worker.js",
		].map((file) => fs.readFile(file, "utf8")),
	)
).join("\n");
if (
	/node_modules\/(braces|micromatch|fast-glob|openai|@anthropic-ai)\//.test(
		bundle,
	)
)
	throw Error("Unrelated glob tooling leaked into the desktop runtime");
const native = JSON.parse(
	await fs.readFile("dist/catalog-native/provenance.json", "utf8"),
);
const sqlite = await fs.readFile(
	"dist/catalog-native/node_modules/better-sqlite3/build/Release/better_sqlite3.node",
);
if (native.sha256 !== createHash("sha256").update(sqlite).digest("hex"))
	throw new Error("Catalog native binding provenance mismatch");
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
	arch: process.arch,
	out: "release",
	overwrite: true,
	prune: false,
	asar: { unpackDir: "dist/catalog-native" },
	extraResource,
	ignore: (file) =>
		/^\/(node_modules|vendor|test|test-results|evidence|recovery|\.git|dist\/native)(\/|$)/.test(
			file,
		) ||
		file.endsWith("/.DS_Store") ||
		/\/catalog-native\/node_modules\/better-sqlite3\/(src|deps)(\/|$)/.test(
			file,
		) ||
		(/\/catalog-native\/node_modules\/better-sqlite3\/build\//.test(file) &&
			!file.endsWith("/build/Release") &&
			!file.endsWith("/better_sqlite3.node")),
});
console.log(`Unsigned host-architecture package: ${paths.join(", ")}`);
