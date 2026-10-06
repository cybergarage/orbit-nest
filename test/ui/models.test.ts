import { spawn } from "node:child_process";
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
		await page.locator(".model-disclosure").evaluate((e) => {
			(e as HTMLDetailsElement).open = true;
		});
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
		await page.locator("#model").evaluate((select) => {
			const option = document.createElement("option");
			option.textContent =
				"synthetic-missing-model-".repeat(8) +
				" · unavailable in current inventory";
			option.disabled = true;
			option.selected = true;
			select.appendChild(option);
		});
		await app.evaluate(({ BrowserWindow }) =>
			BrowserWindow.getAllWindows()[0].setSize(390, 844),
		);
		await expect
			.poll(() =>
				page.evaluate(
					() => document.documentElement.scrollWidth <= window.innerWidth,
				),
			)
			.toBe(true);
		await app.evaluate(({ BrowserWindow }) =>
			BrowserWindow.getAllWindows()[0].setSize(1200, 900),
		);
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
		await page.locator(".model-disclosure").evaluate((e) => {
			(e as HTMLDetailsElement).open = true;
		});
		await expect
			.poll(() => page.locator("#provider option[value=apple]").isDisabled())
			.toBe(false);
		await page.locator("#provider").selectOption("apple");
		await page.locator("#select-model").evaluate((e) => {
			(e as HTMLButtonElement).click();
			(e as HTMLButtonElement).click();
		});
		await expect
			.poll(async () => {
				const state = (await page.evaluate(() =>
					window.nest.call("state"),
				)) as unknown as { data: { bots: { id: string; provider: string }[] } };
				return state.data.bots.find((b) => b.id === "research")?.provider;
			})
			.toBe("apple");
		await page.locator(".model-disclosure").evaluate((e) => {
			(e as HTMLDetailsElement).open = true;
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
		await page.locator(".model-disclosure").evaluate((e) => {
			(e as HTMLDetailsElement).open = true;
		});
		await expect
			.poll(async () => {
				const state = (await page.evaluate(() =>
					window.nest.call("state"),
				)) as unknown as { data: { bots: { id: string; provider: string }[] } };
				return state.data.bots.find((b) => b.id === "research")?.provider;
			})
			.toBe("apple");
		await page.locator(".model-disclosure").evaluate((e) => {
			(e as HTMLDetailsElement).open = true;
		});
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

test("Quit exits the primary process and a fresh launch can save profiles", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-quit-ui-"));
	let app = await launch(root);
	try {
		await app.firstWindow();
		const secondary = spawn(
			process.env.NEST_PACKAGED
				? path.resolve("scripts/start-packaged.command")
				: app.process().spawnfile,
			process.env.NEST_PACKAGED ? [] : ["."],
			{ env: { ...process.env, NEST_TEST_DATA: root }, stdio: "ignore" },
		);
		try {
			await expect.poll(() => secondary.exitCode).toBe(0);
		} finally {
			if (secondary.exitCode === null) secondary.kill();
		}
		expect(await app.windows()).toHaveLength(1);
		const primaryProcess = app.process();
		await app.evaluate(({ app }) => app.quit()).catch(() => {});
		await expect.poll(() => primaryProcess.exitCode).toBe(0);
		app = await launch(root);
		const page = await app.firstWindow();
		await page.evaluate(async () => {
			await window.nest.call("save", {
				id: "research",
				name: "Synthetic restarted profile",
				role: "Synthetic role",
				memory: "",
			});
		});
		await expect(
			page.getByRole("button", { name: "◈ Synthetic restarted profile" }),
		).toBeVisible();
	} finally {
		await app.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
