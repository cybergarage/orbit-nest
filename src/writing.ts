import { createHash } from "node:crypto";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export interface ManuscriptFile {
	name: string;
	text: string;
	digest: string;
	missing?: boolean;
}
export interface WritingCapture {
	botId: string;
	folder: string;
	selectedFiles: string[];
	capturedAt: string;
	files: ManuscriptFile[];
	baselineRunId?: string;
	baselineCapturedAt?: string;
	comparison: string;
	sourceContext: string;
	omittedCharacters: number;
}
export const WRITING_EXTENSIONS = /\.(md|adoc|asciidoc|txt)$/i;
export function safeName(name: string): void {
	if (
		!name ||
		name.length > 255 ||
		name.startsWith(".") ||
		/[\\/\0]/.test(name) ||
		!WRITING_EXTENSIONS.test(name)
	)
		throw Error("Choose a supported top-level manuscript filename");
}
export async function manuscriptNames(folder: string): Promise<string[]> {
	if (!folder)
		throw Error("Choose a manuscript folder in Companion settings first");
	if ((await fs.realpath(folder)) !== folder)
		throw Error("Selected folder binding changed. Choose the folder again.");
	const entries = await fs.readdir(folder, { withFileTypes: true });
	const names = entries
		.filter(
			(e) =>
				e.isFile() &&
				!e.name.startsWith(".") &&
				WRITING_EXTENSIONS.test(e.name) &&
				!/[\\/]/.test(e.name),
		)
		.map((e) => e.name)
		.sort();
	if (names.length > 200)
		throw Error(
			"Choose a smaller manuscript folder (at most 200 supported top-level filenames)",
		);
	return names;
}
export async function scopedText(
	folder: string,
	name: string,
	byteLimit: number,
	signal?: AbortSignal,
): Promise<string> {
	signal?.throwIfAborted();
	if (name !== path.basename(name) || /[\\/\0]/.test(name))
		throw Error("Scoped filename required");
	if ((await fs.realpath(folder)) !== folder)
		throw Error("Selected folder binding changed. Choose the folder again.");
	const file = path.join(folder, name);
	const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
	try {
		const before = await handle.stat();
		const binding = await fs.lstat(file);
		if (
			!before.isFile() ||
			binding.isSymbolicLink() ||
			before.dev !== binding.dev ||
			before.ino !== binding.ino ||
			(await fs.realpath(file)) !== file
		)
			throw Error("File binding or symlink access denied");
		if (before.size > byteLimit)
			throw Error(
				`Select a smaller manuscript: ${name} exceeds ${byteLimit / 1024} KiB`,
			);
		const buffer = Buffer.alloc(byteLimit + 1);
		let bytes = 0;
		while (bytes < buffer.length) {
			signal?.throwIfAborted();
			const read = await handle.read(
				buffer,
				bytes,
				buffer.length - bytes,
				bytes,
			);
			if (!read.bytesRead) break;
			bytes += read.bytesRead;
		}
		const after = await handle.stat();
		const current = await fs.lstat(file);
		if (
			bytes > byteLimit ||
			before.size !== after.size ||
			before.mtimeMs !== after.mtimeMs ||
			before.ctimeMs !== after.ctimeMs ||
			current.ino !== after.ino ||
			current.dev !== after.dev ||
			current.isSymbolicLink() ||
			(await fs.realpath(file)) !== file
		)
			throw Error(
				"Manuscript changed during capture. Save the file and review again.",
			);
		const text = new TextDecoder("utf-8", { fatal: true }).decode(
			buffer.subarray(0, bytes),
		);
		if (text.includes("\0"))
			throw Error("Only UTF-8 text manuscripts are supported");
		return text;
	} finally {
		await handle.close();
	}
}
export function scopeKey(folder: string, names: string[]): string {
	return JSON.stringify([folder, [...names].sort()]);
}
function clip(text: string, limit: number): string {
	return text.length > limit
		? `${text.slice(0, limit)}\n[${text.length - limit} characters omitted]`
		: text;
}
function region(oldText: string, newText: string): string {
	const oldLines = oldText.split("\n"),
		newLines = newText.split("\n");
	let prefix = 0,
		suffix = 0;
	while (
		prefix < Math.min(oldLines.length, newLines.length) &&
		oldLines[prefix] === newLines[prefix]
	)
		prefix++;
	while (
		suffix < Math.min(oldLines.length - prefix, newLines.length - prefix) &&
		oldLines[oldLines.length - suffix - 1] ===
			newLines[newLines.length - suffix - 1]
	)
		suffix++;
	const oldRegion = oldLines.slice(prefix, oldLines.length - suffix).join("\n");
	const newRegion = newLines.slice(prefix, newLines.length - suffix).join("\n");
	return `Changed region begins at line ${prefix + 1}. This comparison can include unchanged lines between edits; it is not a minimal diff.\nBefore:\n${clip(oldRegion || "[empty]", 1800)}\nAfter:\n${clip(newRegion || "[empty]", 1800)}`;
}
export async function captureWriting(
	botId: string,
	folder: string,
	selectedFiles: string[],
	previous?: { runId: string; capture: WritingCapture },
	signal?: AbortSignal,
): Promise<WritingCapture> {
	if (
		!selectedFiles.length ||
		selectedFiles.length > 12 ||
		new Set(selectedFiles).size !== selectedFiles.length
	)
		throw Error("Select 1–12 manuscript files in Companion settings first");
	for (const name of selectedFiles) safeName(name);
	const names = [...selectedFiles].sort();
	const files: ManuscriptFile[] = [];
	let totalBytes = 0;
	for (const name of names) {
		signal?.throwIfAborted();
		let text: string;
		try {
			text = await scopedText(folder, name, 128 * 1024, signal);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				files.push({ name, text: "", digest: "", missing: true });
				continue;
			}
			throw error;
		}
		totalBytes += Buffer.byteLength(text);
		if (totalBytes > 256 * 1024)
			throw Error("Selected manuscripts exceed 256 KiB. Choose fewer files.");
		files.push({
			name,
			text,
			digest: createHash("sha256").update(text).digest("hex"),
		});
	}
	if (files.every((f) => f.missing))
		throw Error(
			"The selected manuscripts are missing. Choose existing files in Companion settings.",
		);
	const compatible =
		previous &&
		previous.capture.botId === botId &&
		scopeKey(previous.capture.folder, previous.capture.selectedFiles) ===
			scopeKey(folder, names)
			? previous
			: undefined;
	const comparison: string[] = [];
	const changes: string[] = [];
	if (!compatible)
		comparison.push(
			"Initial baseline: no previous successful review for this Companion and file selection. No earlier changes are claimed.",
		);
	else
		comparison.push(
			`Compared with saved review ${compatible.runId} (${compatible.capture.capturedAt}).`,
		);
	for (const file of files) {
		const old = compatible?.capture.files.find((f) => f.name === file.name);
		const status = !compatible
			? file.missing
				? "missing"
				: "initial"
			: file.missing
				? old?.missing
					? "still missing"
					: "missing since prior review"
				: !old || old.missing
					? "now present"
					: old.digest === file.digest
						? "unchanged"
						: "changed";
		comparison.push(
			`${file.name}: ${status}${file.missing ? "" : `; ${file.text.length} characters; SHA-256 ${file.digest.slice(0, 12)}`}`,
		);
		if (status === "changed" && old)
			changes.push(`--- ${file.name} ---\n${region(old.text, file.text)}`);
		if (status === "now present")
			changes.push(
				`--- ${file.name}: newly present in this selected scope ---\n${clip(file.text, 2400)}`,
			);
	}
	const excerptBudget = Math.floor(
		12000 / files.filter((f) => !f.missing).length,
	);
	let omittedCharacters = 0;
	const excerpts = files
		.filter((f) => !f.missing)
		.map((file) => {
			omittedCharacters += Math.max(0, file.text.length - excerptBudget);
			return `--- ${file.name}; excerpt ${Math.min(file.text.length, excerptBudget)}/${file.text.length} characters ---\n${clip(file.text, excerptBudget)}`;
		});
	const changedContext = clip(changes.join("\n\n"), 8000);
	const sourceContext = `Verified comparison:\n${comparison.join("\n")}\n\nChanged regions (bounded):\n${changedContext || "None claimed."}\n\nCurrent manuscript excerpts (bounded):\n${excerpts.join("\n\n")}`;
	return {
		botId,
		folder,
		selectedFiles: names,
		capturedAt: new Date().toISOString(),
		files,
		...(compatible
			? {
					baselineRunId: compatible.runId,
					baselineCapturedAt: compatible.capture.capturedAt,
				}
			: {}),
		comparison: comparison.join("\n"),
		sourceContext,
		omittedCharacters,
	};
}
