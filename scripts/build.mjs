import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { build } from "esbuild";

// The pinned Apple adapter imports broad export barrels. Resolve only its exact
// named implementations, preserving the provider while excluding unused tool/cloud registries.
const appleTextImports = {
	"../../processor/index.js": "../../processor/operator.js",
	"../../message/index.js": "../../message/message.js",
	"../../errors/index.js": "../../errors/errors.js",
	"../../tools/index.js": "../../tools/definition.js",
};
const appleTextOnly = {
	name: "pinned-apple-text-imports",
	setup(builder) {
		builder.onResolve({ filter: /index\.js$/ }, (args) => {
			const caller = args.importer.replaceAll("\\", "/");
			if (
				!(
					caller.endsWith("/core/models/adapters/apple.js") ||
					caller.endsWith("/core/models/adapters/tools.js")
				)
			)
				return;
			const target = appleTextImports[args.path];
			if (target) return { path: path.resolve(args.resolveDir, target) };
		});
	},
};
await fs.mkdir("dist", { recursive: true });
for (const name of ["main", "preload"])
	await build({
		entryPoints: [`src/${name}.ts`],
		bundle: true,
		platform: "node",
		format: "cjs",
		external: ["electron"],
		plugins: [appleTextOnly],
		outfile: `dist/${name}.cjs`,
	});
await build({
	entryPoints: ["src/ui.ts"],
	bundle: true,
	platform: "browser",
	format: "iife",
	outfile: "dist/ui.js",
});
for (const file of ["index.html", "ui.css"])
	await fs.copyFile(`src/${file}`, `dist/${file}`);

await fs.mkdir("dist/assets", { recursive: true });
await Promise.all(
	["moku.png", "owl.svg", "fox.svg"].map((obsolete) =>
		fs.rm(`dist/assets/${obsolete}`, { force: true }),
	),
);
for (const asset of ["gummy-characters.png", "NunitoSans.ttf"])
	await fs.copyFile(`src/assets/${asset}`, `dist/assets/${asset}`);

if (process.platform === "darwin")
	await promisify(execFile)(process.execPath, ["scripts/build-catalog.mjs"]);
const catalogDir = "dist/catalog-native";
await fs.mkdir(catalogDir, { recursive: true });
await fs.writeFile(
	`${catalogDir}/package.json`,
	JSON.stringify({ private: true, type: "module" }),
);
for (const [entry, outfile] of [
	["src/project-context.ts", "context.mjs"],
	[
		"node_modules/@cybergarage/orbit/dist/core/projects/sqlite-worker.js",
		"sqlite-worker.js",
	],
])
	await build({
		entryPoints: [entry],
		bundle: true,
		platform: "node",
		format: "esm",
		external: ["better-sqlite3"],
		plugins: [appleTextOnly],
		banner: {
			js: 'import { createRequire as nestCreateRequire } from "node:module"; const require = nestCreateRequire(import.meta.url);',
		},
		outfile: `${catalogDir}/${outfile}`,
	});

if (process.platform === "darwin") {
	const nativePin = JSON.parse(
		await fs.readFile(`${catalogDir}/provenance.json`, "utf8"),
	);
	const corePin = JSON.parse(
		await fs.readFile("vendor/core-provenance.json", "utf8"),
	);
	const hashes = {};
	for (const file of [
		"context.mjs",
		"sqlite-worker.js",
		"node_modules/better-sqlite3/build/Release/better_sqlite3.node",
	])
		hashes[file] = createHash("sha256")
			.update(await fs.readFile(`${catalogDir}/${file}`))
			.digest("hex");
	await fs.writeFile(
		`${catalogDir}/bundle-provenance.json`,
		JSON.stringify(
			{
				sourceCommit: corePin.sourceCommit,
				identity: nativePin.identity,
				hashes,
			},
			null,
			2,
		),
	);
}
