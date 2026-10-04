import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
if (process.platform !== "darwin" || process.arch !== "arm64")
	throw Error(
		"Optional Apple helper build requires an Apple silicon Mac. Ordinary Nest install/build stays portable.",
	);
const source =
	"node_modules/@cybergarage/orbit/native/apple-foundation-models/main.swift";
const pin = JSON.parse(
	await fs.readFile("vendor/core-provenance.json", "utf8"),
);
const bytes = await fs.readFile(source);
if (createHash("sha256").update(bytes).digest("hex") !== pin.appleSourceSha256)
	throw Error("Apple source does not match pinned core");
await fs.mkdir("dist/native", { recursive: true });
const output = path.resolve("dist/native/orbit-apple-helper");
try {
	execFileSync(
		"xcrun",
		[
			"swiftc",
			"-parse-as-library",
			"-O",
			"-target",
			"arm64-apple-macos26.0",
			source,
			"-o",
			output,
		],
		{ stdio: "inherit" },
	);
} catch {
	throw Error(
		"Explicit Apple helper compilation failed. Review your already-installed compatible SDK/compiler and any agreement yourself. Nest never accepts agreements or changes Xcode selection.",
	);
}
const binary = await fs.readFile(output);
await fs.writeFile(
	"dist/native/apple-helper-provenance.json",
	`${JSON.stringify(
		{
			sourceCommit: pin.sourceCommit,
			sourceSha256: pin.appleSourceSha256,
			binarySha256: createHash("sha256").update(binary).digest("hex"),
			target: "arm64-apple-macos26.0",
			optional: true,
		},
		null,
		2,
	)}\n`,
);
console.log(
	"Optional Apple helper compiled explicitly under dist/native. Include it with NEST_INCLUDE_APPLE=1 npm run package.",
);
