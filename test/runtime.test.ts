import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { publicPage, Runtime, readFolder } from "../src/runtime";

test("folder summaries reject symlinks, large files and unsupported network targets", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-safe-"));
	try {
		await fs.writeFile(
			path.join(root, "note.md"),
			"Synthetic meeting: Friday at noon.",
		);
		await fs.symlink("/etc/passwd", path.join(root, "private.txt"));
		assert.match(await readFolder(await fs.realpath(root)), /Synthetic/);
		assert.doesNotMatch(await readFolder(await fs.realpath(root)), /root:/);
		await fs.writeFile(path.join(root, "large.txt"), "x".repeat(32001));
		await assert.rejects(readFolder(await fs.realpath(root)), /31.25 KiB/);
		for (const url of [
			"http://example.com",
			"https://127.0.0.1",
			"https://evil.example",
			"https://example.com:9999",
			"https://u:p@example.com",
		])
			assert.throws(() => publicPage(url));
		assert.equal(publicPage("https://example.com/").hostname, "example.com");
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
});
test("renderer profile input cannot grant folders; memory mutation requires surviving approval", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-memory-"));
	let runtime = new Runtime(path.join(root, "work.json"));
	try {
		const bot = runtime.bot("documents");
		runtime.save({ ...bot, folder: "/etc" });
		assert.equal(runtime.bot("documents").folder, undefined);
		const id = runtime.store.enqueue("synthetic-summary", {
			botId: "documents",
			prompt: "test",
		});
		const attempt = runtime.store.claim(id);
		runtime.store.finish(id, attempt.id, "succeeded", "Synthetic memory only");
		runtime.remember(id);
		await runtime.close();
		runtime = new Runtime(path.join(root, "work.json"));
		assert.equal(runtime.store.snapshot().runs[1].status, "approval");
		runtime.store.approve(runtime.store.snapshot().runs[1].id, true);
		await runtime.tick();
		assert.equal(runtime.bot("documents").memory, "Synthetic memory only");
		assert.equal(runtime.store.snapshot().runs[1].status, "succeeded");
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("shutdown prevents timer ticks from writing to a closed store and preserves profiles", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-shutdown-"));
	const file = path.join(root, "work.json");
	let runtime = new Runtime(file);
	try {
		runtime.save({ ...runtime.bot("research"), name: "Synthetic saved profile" });
		await runtime.close();
		const saved = await fs.readFile(file, "utf8");
		await runtime.tick();
		await runtime.close();
		assert.equal(await fs.readFile(file, "utf8"), saved);
		runtime = new Runtime(file);
		assert.equal(runtime.bot("research").name, "Synthetic saved profile");
		runtime.save({ ...runtime.bot("research"), tone: "Synthetic restart tone" });
		await runtime.close();
		runtime = new Runtime(file);
		assert.equal(runtime.bot("research").tone, "Synthetic restart tone");
	} finally {
		await runtime.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
