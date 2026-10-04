import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { Runtime } from "../../src/runtime";
const launch = (root: string) =>
	electron.launch({
		args: process.env.NEST_PACKAGED
			? []
			: process.env.CI
				? [".", "--no-sandbox"]
				: ["."],
		executablePath: process.env.NEST_PACKAGED || undefined,
		env: { ...process.env, NEST_TEST_DATA: root },
	});
test("local setup reports inventory and disabled cloud without changing saved profiles", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-model-ui-"));
	const app = await launch(root);
	try {
		const page = await app.firstWindow();
		await page.getByRole("button", { name: "◈ Research companion" }).click();
		await expect(
			page.getByRole("heading", { name: "Local model setup" }),
		).toBeVisible();
		await page
			.getByRole("button", { name: "Check available models", exact: true })
			.click();
		await expect(
			page.getByText(/Cloud execution is not configured/).first(),
		).toBeVisible();
		await expect(
			page.locator("#provider option").filter({ hasText: "Cloud" }),
		).toHaveJSProperty("disabled", true);
		const denied = await page.evaluate(async () => {
			try {
				await window.nest.call("select-model", {
					id: "research",
					provider: "cloud",
					model: "paid",
					profileRevision: 0,
				});
				return false;
			} catch {
				return true;
			}
		});
		expect(denied).toBe(true);
		const state = (await page.evaluate(() => window.nest.call("state"))) as {
			runs: unknown[];
		};
		expect(state.runs).toHaveLength(0);
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.screenshot({ path: "evidence/model-setup.png", fullPage: true });
	} finally {
		await app.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
test("opt-in actual Apple text chat works in native or packaged UI and persists selection", async () => {
	test.skip(
		process.env.NEST_LIVE_APPLE !== "1",
		"Requires explicitly built optional helper and already-ready Apple model on M4.",
	);
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-apple-ui-"));
	const fixture = new Runtime(path.join(root, "work.json"));
	fixture.save({
		...fixture.bot("research"),
		role: "Reply briefly in English to synthetic facts.",
		tone: "Brief and precise",
	});
	await fixture.close();
	let app = await launch(root);
	try {
		let page = await app.firstWindow();
		await page.getByRole("button", { name: "◈ Research companion" }).click();
		await expect
			.poll(() => page.locator("#provider option[value=apple]").isDisabled())
			.toBe(false);
		await page.locator("#provider").selectOption("apple");
		await page.locator("#select-model").evaluate((e) => {
			(e as HTMLButtonElement).click();
			(e as HTMLButtonElement).click();
		});
		await expect(
			page.getByText("Local · apple / system", { exact: true }),
		).toBeVisible();
		await page
			.locator("#prompt")
			.fill(
				"Remember that my favorite color is cobalt. Acknowledge this briefly.",
			);
		await page.getByRole("button", { name: "Preview task" }).click();
		await page.getByRole("button", { name: "Send", exact: true }).click();
		await expect(page.locator("#activity .succeeded")).toHaveCount(1, {
			timeout: 20000,
		});
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.screenshot({ path: "evidence/apple-chat.png", fullPage: true });
		await app.close();
		app = await launch(root);
		page = await app.firstWindow();
		await page.getByRole("button", { name: "◈ Research companion" }).click();
		await expect(
			page.getByText("Local · apple / system", { exact: true }),
		).toBeVisible();
		await page.locator("#mode").selectOption("summary");
		await page.locator("#prompt").fill("Read the public page");
		await page.getByRole("button", { name: "Preview task" }).click();
		await expect(page.getByRole("alert")).toContainText("text chat only");
		const state = (await page.evaluate(() => window.nest.call("state"))) as {
			runs: unknown[];
		};
		expect(state.runs).toHaveLength(1);
	} finally {
		await app.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
