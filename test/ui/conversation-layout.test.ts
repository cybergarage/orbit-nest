import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { _electron as electron, expect, test } from "@playwright/test";
import { Runtime } from "../../src/runtime";
import { ProjectContext } from "../../src/project-context";
import { evidencePath } from "./evidence";
import { openBotPanel } from "./navigation";

test("two columns, shared Bot menu, speakers, scoped drafts and bounded scrolling", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-two-column-"));
	const fixture = new Runtime(path.join(root, "work.json"));
	const context = await ProjectContext.open(
		path.join(root, "context"),
		fixture,
	);
	fixture.context = context;
	const project = randomUUID(),
		first = randomUUID(),
		second = randomUUID();
	await context.createProject("moku", "Household", project);
	await context.createSession("moku", project, "Shopping list", first);
	await context.createSession("moku", project, "Reading time", second);
	await context.select("moku", first);
	for (const [prompt, result] of [
		[
			"What should I pick up on the way home?",
			"Milk, eggs and laundry detergent.\nI have prepared a list, not placed an order.",
		],
		[
			"Add coffee too, please.",
			"Added coffee. Your list now has four items.\nWould you like to check anything else?",
		],
	]) {
		const id = fixture.store.enqueue(randomUUID(), {
			botId: "moku",
			prompt,
			kind: "chat",
			nestContextVersion: 1,
			context: {
				botId: "moku",
				projectId: project,
				sessionId: first,
				membershipRevision: 1,
			},
		});
		const attempt = fixture.store.claim(id);
		fixture.store.finish(id, attempt.id, "succeeded", result);
	}
	await fixture.close();
	const app = await electron.launch({
		args: process.env.CI ? [".", "--no-sandbox"] : ["."],
		env: { ...process.env, NEST_TEST_DATA: root },
	});
	try {
		const page = await app.firstWindow();
		const errors: string[] = [];
		page.on("pageerror", (error) => errors.push(error.message));
		await page.setViewportSize({ width: 1280, height: 850 });
		await expect(page.locator(".page-header h1")).toHaveText("Moku");
		await expect(
			page.locator(".navigation,.work-sidebar,.brand,.rail-brand"),
		).toHaveCount(0);
		await expect(page.locator("#bot-panel")).toBeHidden();
		await expect(page.locator(".user-message strong")).toHaveText([
			"You",
			"You",
		]);
		await expect(page.locator(".bot-message strong")).toHaveText([
			"Moku",
			"Moku",
		]);
		await page.evaluate(() => document.fonts.ready);
		await expect(page.locator("#prompt")).toHaveAttribute(
			"placeholder",
			"Message Moku…",
		);
		await expect(
			page.getByRole("button", { name: "Task options", exact: true }),
		).toBeVisible();
		await page.screenshot({ path: evidencePath("conversation-desktop.png") });
		const geometry = await page.evaluate(() => {
			const row = document.querySelector(".bot-row")?.getBoundingClientRect();
			const user = document
				.querySelector(".user-message .message-bubble")
				?.getBoundingClientRect();
			const bot = document
				.querySelector(".bot-message .message-bubble")
				?.getBoundingClientRect();
			if (!row || !user || !bot) throw new Error("Missing message geometry");
			return {
				rowTop: row.top,
				userLeft: user.left,
				botLeft: bot.left,
				columns: getComputedStyle(
					document.querySelector(".app-shell") as HTMLElement,
				).gridTemplateColumns.split(" ").length,
				font: getComputedStyle(document.body).fontFamily,
				shellWidth: document
					.querySelector(".app-shell")
					?.getBoundingClientRect().width,
				headerLayout: getComputedStyle(
					document.querySelector(".page-header") as HTMLElement,
				).display,
			};
		});
		expect(geometry.rowTop).toBe(16);
		expect(geometry.columns).toBe(2);
		expect(geometry.shellWidth).toBe(1280);
		expect(geometry.headerLayout).toBe("flex");
		expect(geometry.userLeft).toBeGreaterThan(geometry.botLeft);
		expect(geometry.font).toContain("Nunito Sans");
		const images = await page
			.locator(".bot-list .gummy,.page-header .gummy,.messages .gummy")
			.evaluateAll((elements) =>
				elements.map((element) => {
					const bounds = element.getBoundingClientRect();
					const image = element.querySelector("img") as HTMLImageElement;
					return {
						width: bounds.width,
						height: bounds.height,
						loaded: image.naturalWidth,
						ratio: image.getBoundingClientRect().width / bounds.width,
						source: image.getAttribute("src"),
					};
				}),
			);
		expect(images.map((image) => image.width)).toEqual([
			44, 44, 44, 56, 32, 32,
		]);
		for (const image of images) {
			expect(image.height).toBe(image.width);
			expect(image.loaded).toBe(1536);
			expect(image.ratio).toBeCloseTo(4.096, 2);
			expect(image.source).toBe("assets/gummy-characters.png");
		}
		const menu = page.locator("#bot-menu-moku");
		await menu.click();
		const menuText = await page.getByRole("menu").innerText();
		await page.screenshot({ path: evidencePath("conversation-menu.png") });
		await page.keyboard.press("End");
		await expect(page.locator("#menu-close")).toBeFocused();
		await page.keyboard.press("Escape");
		await expect(menu).toBeFocused();
		await menu.click();
		await menu.click();
		await expect(page.getByRole("menu")).toHaveCount(0);
		await page.locator(".bot-row.selected").click({ button: "right" });
		expect(await page.getByRole("menu").innerText()).toBe(menuText);
		await page.locator('.bot-menu [data-panel="settings"]').click();
		await expect(page.locator('[data-panel-content="settings"]')).toBeVisible();
		await page.getByRole("button", { name: "Close Bot tools" }).click();
		await expect(menu).toBeFocused();
		await page.locator("#prompt").fill("Shopping unsent draft");
		await openBotPanel(page, "conversations");
		await page.locator(`[data-session="${second}"]`).click();
		await expect(page.locator("#bot-panel")).toBeHidden();
		await expect(page.locator("#prompt")).toHaveValue("");
		await expect(page.locator(".conversation-empty")).toBeVisible();
		await page.locator("#prompt").fill("Reading unsent draft");
		await page
			.getByRole("button", { name: "Switch to Writing companion", exact: true })
			.click();
		await expect(page.locator("#prompt")).toHaveValue("");
		await page
			.getByRole("button", { name: "Switch to Moku", exact: true })
			.click();
		await expect(page.locator("#prompt")).toHaveValue("Reading unsent draft");
		await openBotPanel(page, "conversations");
		await page.locator(`[data-session="${first}"]`).click();
		await expect(page.locator("#prompt")).toHaveValue("Shopping unsent draft");
		// Persist bounded synthetic sends so resize still exercises a long conversation.
		await page.evaluate(async () => {
			for (let index = 0; index < 20; index++)
				await window.nest.call("chat", {
					id: "moku",
					prompt: `What is today's weather? Synthetic long conversation ${index}`,
					requestId: `layout-long-${index}`,
					sessionId:
						document.querySelector<HTMLSelectElement>("#context-session")
							?.value ?? "",
				});
		});
		await expect(page.locator(".user-message")).toHaveCount(22);
		await page.locator("#messages").focus();
		await page.keyboard.press("Home");
		await expect
			.poll(() =>
				page.locator("#messages").evaluate((element) => element.scrollTop),
			)
			.toBe(0);
		await page.keyboard.press("End");
		await expect
			.poll(() =>
				page.locator("#messages").evaluate((element) => element.scrollTop),
			)
			.toBeGreaterThan(0);

		for (const width of [900, 390, 1280]) {
			await page.setViewportSize({ width, height: 850 });
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth,
				),
			).toBe(true);
			expect(
				await page
					.locator(".bot-list")
					.evaluate((element) => element.scrollWidth <= element.clientWidth),
			).toBe(true);
			const composer = await page.locator(".composer").boundingBox();
			if (!composer) throw new Error("Missing composer");
			expect(composer.y + composer.height).toBeLessThanOrEqual(850);
			await expect(page.locator("#prompt")).toBeVisible();
		}
		await page.setViewportSize({ width: 390, height: 850 });
		await page.screenshot({ path: evidencePath("conversation-narrow.png") });
		await openBotPanel(page, "projects");
		await expect(page.locator("#context-session")).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(page.locator("#bot-panel")).toBeHidden();
		await page.locator("#bot-menu-research").focus();
		await page.keyboard.press("Shift+F10");
		await expect(page.locator(".page-header h1")).toHaveText(
			"Research companion",
		);
		await expect(page.locator("#bot-menu-research")).toHaveAttribute(
			"aria-expanded",
			"true",
		);
		await page
			.getByRole("menuitem", { name: "Close menu", exact: true })
			.click();
		await expect(page.locator("#bot-menu-research")).toBeFocused();
		expect(errors).toEqual([]);
	} finally {
		await app.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});

test("empty Bot list offers creation without management cards", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-empty-layout-"));
	const fixture = new Runtime(path.join(root, "work.json"));
	fixture.store.setData("bots", []);
	await fixture.close();
	const app = await electron.launch({
		args: process.env.CI ? [".", "--no-sandbox"] : ["."],
		env: { ...process.env, NEST_TEST_DATA: root },
	});
	try {
		const page = await app.firstWindow();
		await expect(page.locator(".conversation-empty")).toContainText(
			"No Bots yet",
		);
		await expect(
			page.locator(".companion-card,#activity,.navigation,.work-sidebar"),
		).toHaveCount(0);
		await page.getByRole("button", { name: "+ Add Bot", exact: true }).click();
		await expect(
			page.getByRole("button", { name: "Add Moku", exact: true }),
		).toBeVisible();
	} finally {
		await app.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
