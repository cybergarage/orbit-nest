import fs from "node:fs/promises";
import path from "node:path";
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
