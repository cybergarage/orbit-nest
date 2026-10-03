import fs from "node:fs/promises";
import { build } from "esbuild";

await fs.mkdir("dist", { recursive: true });
for (const name of ["main", "preload"])
	await build({
		entryPoints: [`src/${name}.ts`],
		bundle: true,
		platform: "node",
		format: "cjs",
		external: ["electron"],
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
