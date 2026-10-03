import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { Runtime } from "../../src/runtime";

test("safe desktop home, profiles, approval survival, window lifecycle and renderer boundary", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-ui-"));
	const fixture = new Runtime(path.join(root, "work.json"));
	const run = fixture.store.enqueue("ui-fixture", {
		botId: "documents",
		prompt: "Summarize synthetic meeting note",
	});
	const a = fixture.store.claim(run);
	fixture.store.finish(
		run,
		a.id,
		"succeeded",
		"The synthetic meeting is on Friday at noon. Prepare an agenda.",
	);
	fixture.remember(run);
	await fixture.close();
	const launch = () =>
		electron.launch({
			args: process.env.NEST_PACKAGED
				? []
				: process.env.CI
					? [".", "--no-sandbox"]
					: ["."],
			executablePath: process.env.NEST_PACKAGED || undefined,
			env: { ...process.env, NEST_TEST_DATA: root },
		});
	let app = await launch();
	let page = await app.firstWindow();
	try {
		await expect(
			page.getByRole("heading", { name: "Welcome home" }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Approve memory replacement" }),
		).toBeVisible();
		expect(
			await page.evaluate(
				() => typeof (window as unknown as { require: unknown }).require,
			),
		).toBe("undefined");
		const denied = await page.evaluate(async () => {
			try {
				await window.nest.call("shell", { command: "whoami" });
				return false;
			} catch {
				return true;
			}
		});
		expect(denied).toBe(true);
		await page.screenshot({ path: "evidence/home.png" });
		await app.close();
		app = await launch();
		page = await app.firstWindow();
		await page
			.getByRole("button", { name: "Approve memory replacement" })
			.click();
		await expect(
			page.getByText("Memory updated", { exact: true }),
		).toBeVisible();
		await page.getByRole("button", { name: "▤ Document organizer" }).click();
		await page.getByText("Profile, memory & permissions").click();
		await expect(page.locator("#memory")).toHaveValue(
			"The synthetic meeting is on Friday at noon. Prepare an agenda.",
		);
		await page.locator("#name").fill("My document helper");
		await page.getByRole("button", { name: "Save profile" }).click();
		await expect(
			page.getByRole("heading", { name: "My document helper" }),
		).toBeVisible();
		await page.locator("#prompt").fill("Summarize selected documents");
		await page
			.getByRole("button", { name: "Schedule task", exact: true })
			.click();
		await expect(
			page.getByRole("button", { name: "Pause", exact: true }),
		).toBeVisible();
		await page.getByRole("button", { name: "Pause", exact: true }).click();
		await expect(
			page.getByRole("button", { name: "Resume", exact: true }),
		).toBeVisible();
		await page.screenshot({ path: "evidence/bot.png" });
		const closedId = await app.evaluate(async ({ BrowserWindow }) => {
			const window = BrowserWindow.getAllWindows()[0];
			const id = window.id;
			await new Promise<void>((resolve) => {
				window.once("closed", () => resolve());
				window.close();
			});
			return id;
		});
		expect(
			await app.evaluate(
				({ BrowserWindow }, id) => BrowserWindow.fromId(id) === null,
				closedId,
			),
		).toBe(true);
		const existing = app.windows().find((window) => !window.isClosed());
		const reopened = existing
			? Promise.resolve(existing)
			: app.waitForEvent("window");
		await app.evaluate(({ app }) => {
			app.emit("activate");
		});
		page = await reopened;
		await expect(
			page.getByRole("heading", { name: "Welcome home" }),
		).toBeVisible();
	} finally {
		await app.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
