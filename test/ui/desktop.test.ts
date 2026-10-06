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
			page.locator("#activity").getByText("Memory updated", { exact: true }),
		).toBeVisible();
		await page.getByRole("button", { name: "▤ Writing companion" }).click();
		await page
			.getByText("Customize Companion · profile, memory & permissions")
			.click();
		await expect(page.locator("#memory")).toHaveValue(
			"The synthetic meeting is on Friday at noon. Prepare an agenda.",
		);
		await page.locator("#name").fill("My document helper");
		await page.locator("#personality").fill("A patient editor");
		await page.locator("#tone").fill("Brief and concrete");
		await page.getByRole("button", { name: "◈ Research companion" }).click();
		await page
			.getByText("Customize Companion · profile, memory & permissions")
			.click();
		await expect(page.locator("#name")).toHaveValue("Research companion");
		await page.getByRole("button", { name: "▤ Writing companion" }).click();
		await expect(page.locator("#name")).toHaveValue("My document helper");
		await expect(page.locator("#personality")).toHaveValue("A patient editor");
		if (
			!(await page
				.locator("#settings")
				.evaluate((e) => (e as HTMLDetailsElement).open))
		)
			await page
				.getByText("Customize Companion · profile, memory & permissions")
				.click();
		await page.getByRole("button", { name: "Save profile" }).click();
		await expect(
			page.getByRole("heading", { name: "My document helper", exact: true }),
		).toBeVisible();
		await page.locator("#prompt").fill("明日の天気は？");
		await page
			.getByRole("button", { name: "Preview task", exact: true })
			.click();
		await page.getByRole("button", { name: "Send", exact: true }).click();
		await expect(
			page.getByText(/Live weather lookup is not available/),
		).toBeVisible();
		await page.locator("#prompt").fill("Summarize selected documents");
		await page
			.getByRole("button", { name: "Preview task", exact: true })
			.click();
		await page
			.getByText("Recurring jobs · review before enabling", { exact: true })
			.click();
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
		await page.screenshot({ path: "evidence/bot.png", fullPage: true });
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

test("explicit manuscript selection and source-mode routine persist", async () => {
	const root = await fs.realpath(
		await fs.mkdtemp(path.join(os.tmpdir(), "nest-writing-ui-")),
	);
	const folder = path.join(root, "manuscripts");
	await fs.mkdir(folder);
	await fs.writeFile(
		path.join(folder, "harbor.adoc"),
		"= Synthetic Harbor\nMira reaches the harbor.",
	);
	await fs.writeFile(
		path.join(folder, "notes.md"),
		"# Synthetic notes\nClarify her goal.",
	);
	const fixture = new Runtime(path.join(root, "work.json"));
	fixture.grantFolder("documents", folder);
	await fixture.close();
	const app = await electron.launch({
		args: process.env.NEST_PACKAGED
			? []
			: process.env.CI
				? [".", "--no-sandbox"]
				: ["."],
		executablePath: process.env.NEST_PACKAGED || undefined,
		env: { ...process.env, NEST_TEST_DATA: root },
	});
	try {
		const page = await app.firstWindow();
		await page.getByRole("button", { name: "▤ Writing companion" }).click();
		await page
			.getByText("Customize Companion · profile, memory & permissions")
			.click();
		await page.getByRole("button", { name: "Refresh manuscript list" }).click();
		await page
			.getByRole("checkbox", { name: "harbor.adoc", exact: true })
			.check();
		await page.getByRole("checkbox", { name: "notes.md", exact: true }).check();
		await page
			.getByRole("button", { name: "Save manuscript selection" })
			.click();
		await expect(
			page.getByText("Selected: harbor.adoc, notes.md", { exact: true }),
		).toBeVisible();
		await page
			.getByRole("combobox", { name: "Task mode" })
			.selectOption("writing-review");
		await page
			.locator("#prompt")
			.fill("Review the synthetic manuscripts and give next revision points.");
		await page
			.getByRole("button", { name: "Preview task", exact: true })
			.click();
		await page
			.getByText("Recurring jobs · review before enabling", { exact: true })
			.click();
		await page
			.getByRole("button", { name: "Schedule task", exact: true })
			.click();
		await page.getByRole("button", { name: "Pause", exact: true }).click();
		const state = (await page.evaluate(() => window.nest.call("state"))) as {
			schedules: {
				paused: boolean;
				payload: { kind: string; scope: { files: string[] } };
			}[];
		};
		expect(state.schedules[0].payload.kind).toBe("writing-review");
		expect(state.schedules[0].payload.scope.files).toEqual([
			"harbor.adoc",
			"notes.md",
		]);
		expect(state.schedules[0].paused).toBe(true);
		await page.screenshot({
			path: "evidence/writing-settings.png",
			fullPage: true,
		});
	} finally {
		await app.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
