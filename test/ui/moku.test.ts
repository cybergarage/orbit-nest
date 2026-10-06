import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import type { WorkState } from "@cybergarage/orbit/dist/core/execution/scheduled-work.js";
import { Runtime, type Bot } from "../../src/runtime";

test("Moku creation, focus, no-loss decorations, disconnected plugins and restart survive navigation", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-moku-ui-"));
	const legacy = new Runtime(path.join(root, "work.json"));
	legacy.store.setData(
		"bots",
		legacy.bots().filter((b) => b.id !== "moku"),
	);
	await legacy.close();
	const launch = () =>
		electron.launch({
			args: process.env.NEST_PACKAGED
				? []
				: process.env.CI
					? [".", "--no-sandbox"]
					: ["."],
			executablePath: process.env.NEST_PACKAGED,
			env: { ...process.env, NEST_TEST_DATA: root },
		});
	let app = await launch();
	try {
		let page = await app.firstWindow();
		await page.getByRole("button", { name: "Add a Bot", exact: true }).click();
		await page
			.getByRole("button", { name: "Add Moku", exact: true })
			.evaluate((e) => {
				(e as HTMLButtonElement).click();
				(e as HTMLButtonElement).click();
			});
		await expect(
			page
				.locator(".navigation")
				.getByRole("button", { name: "🌱 Moku", exact: true }),
		).toHaveCount(1);
		await page
			.locator(".navigation")
			.getByRole("button", { name: "🌱 Moku", exact: true })
			.click();
		await expect(page.locator(".page-header img")).toHaveJSProperty(
			"naturalWidth",
			1254,
		);
		await page.locator("#nurturing").check();
		await page.locator("#focus-step").fill("Write one synthetic transition");
		await page
			.getByRole("button", { name: "Start quiet focus", exact: true })
			.click();
		await expect(
			page.getByRole("button", { name: "Pause focus", exact: true }),
		).toBeVisible();
		await page
			.getByRole("button", { name: "Pause focus", exact: true })
			.click();
		await page.locator("#progress").fill("I wrote a rough transition");
		await page.locator("#next-step").fill("Reread the transition");
		await page
			.getByRole("button", {
				name: "Finish / take a break & leave a note",
				exact: true,
			})
			.click();
		await expect(
			page
				.getByText("Reported by you: I wrote a rough transition", {
					exact: true,
				})
				.first(),
		).toBeVisible();
		await page
			.getByRole("button", { name: "Place leaf cushion", exact: true })
			.click();
		await expect(
			page.getByRole("button", { name: "Remove leaf cushion", exact: true }),
		).toBeVisible();
		await page
			.locator("#prompt")
			.fill("A synthetic draft kept across navigation");
		await page.getByRole("button", { name: "Tasks", exact: true }).click();
		await page.locator("#owner-filter").selectOption({ label: "Moku" });
		await expect(
			page.getByText("Reported progress: I wrote a rough transition", {
				exact: true,
			}),
		).toBeVisible();
		await page.getByRole("button", { name: "Open Moku", exact: true }).click();
		await expect(page.locator("#prompt")).toHaveValue(
			"A synthetic draft kept across navigation",
		);
		await page
			.locator("#prompt")
			.fill("Synthetic local chat with an unselected model");
		await page.getByRole("button", { name: "Send", exact: true }).click();
		await expect(page.locator("#activity .failed")).toHaveCount(1, {
			timeout: 20000,
		});
		await page.screenshot({
			path: "evidence/moku-conversation.png",
			fullPage: true,
		});
		await page.getByRole("button", { name: "Plugins", exact: true }).click();
		await expect(
			page.getByRole("heading", { name: "Gmail · unavailable" }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Send · unavailable", exact: true }),
		).toBeDisabled();
		const saved = (await page.evaluate(() =>
			window.nest.call("state"),
		)) as WorkState;
		const moku = (saved.data.bots as Bot[]).find((b) => b.template === "moku");
		expect(moku).toBeDefined();
		await app.evaluate(({ BrowserWindow }) =>
			BrowserWindow.getAllWindows()[0].setSize(390, 844),
		);
		await expect
			.poll(() =>
				page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
			)
			.toBe(true);
		await page.screenshot({ path: "evidence/moku-narrow.png", fullPage: true });
		await app.close();
		app = await launch();
		page = await app.firstWindow();
		await page.getByRole("button", { name: "🌱 Moku", exact: true }).click();
		await expect(
			page
				.getByText("Next step: Reread the transition", { exact: true })
				.first(),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Remove leaf cushion", exact: true }),
		).toBeVisible();
		await page.getByRole("button", { name: "Home", exact: true }).click();
		await page.screenshot({ path: "evidence/moku-home.png", fullPage: true });
	} finally {
		await app.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
