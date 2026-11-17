import { openBotPanel, openAppView } from "./navigation";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
	_electron as electron,
	expect,
	test,
	type Page,
} from "@playwright/test";
import type { WorkState } from "@cybergarage/orbit/dist/core/execution/scheduled-work.js";
import { Runtime } from "../../src/runtime";
import { ProjectContext } from "../../src/project-context";
import { evidencePath } from "./evidence";
const snapshot = (page: Page) =>
	page.evaluate(() => window.nest.call("state")) as Promise<WorkState>;

test("character selection, scoped drafts, unread results, appearance review and notes stay separate across navigation and restart", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-characters-ui-"));
	const fixture = new Runtime(path.join(root, "work.json"));
	const context = await ProjectContext.open(
		path.join(root, "context"),
		fixture,
	);
	fixture.context = context;
	const alpha = randomUUID(),
		beta = randomUUID(),
		other = randomUUID();
	const a = randomUUID(),
		b = randomUUID(),
		c = randomUUID();
	await context.createProject("moku", "Household", alpha);
	await context.createProject("moku", "Learning", beta);
	await context.createSession("moku", alpha, "Shopping list", a);
	await context.createSession("moku", beta, "Reading time", b);
	await context.createProject("documents", "Writing", other);
	await context.createSession("documents", other, "First draft", c);
	await context.select("moku", a);

	await context.addMemory("moku", "Synthetic household note", randomUUID(), a);
	await fixture.chat(
		"moku",
		"What is today's weather?",
		"gummy-alpha-result",
		a,
	);
	await fixture.tick();
	await context.select("documents", c);

	await context.addMemory(
		"documents",
		"Synthetic writing note",
		randomUUID(),
		c,
	);
	fixture.setAppearance("documents", "Sky");
	const saved = fixture.store.enqueue("gummy-approval", {
		botId: "research",
		prompt: "Synthetic approval source",
	});
	const attempt = fixture.store.claim(saved);
	fixture.store.finish(
		saved,
		attempt.id,
		"succeeded",
		"Synthetic pending memory",
	);
	fixture.remember(saved);
	const approval = fixture.approvalRequests()[0];
	await fixture.close();
	const launch = () =>
		electron.launch({
			args: process.env.NEST_PACKAGED
				? []
				: process.env.CI
					? [".", "--no-sandbox"]
					: ["."],
			executablePath: process.env.NEST_PACKAGED || undefined,
			cwd: process.env.NEST_PACKAGED ? root : undefined,
			env: { ...process.env, NEST_TEST_DATA: root },
		});
	let app = await launch();
	try {
		let page = await app.firstWindow();
		await page.setViewportSize({ width: 1440, height: 1000 });
		const switchTo = (name: string) =>
			page
				.getByRole("button", { name: `Switch to ${name}`, exact: true })
				.click();
		await switchTo("Moku");
		await expect(page.locator(".page-header")).toContainText(
			"Household / Shopping list",
		);
		await expect(page.locator(".recipient-label")).toContainText(
			"Sending to Moku · Household / Shopping list",
		);
		await expect(page.locator('[data-bot-unread="moku"]')).toHaveText(
			"1 unseen",
		);
		await openBotPanel(page, "tasks");
		await page.locator(".work-filters > summary").click();
		for (const status of ["succeeded", "all", "succeeded", "all"]) {
			await openBotPanel(page, "tasks");
			await page.locator(`.work-filters [data-filter="${status}"]`).click();
			expect(
				await page
					.locator(".work-filters")
					.evaluate((element) => (element as HTMLDetailsElement).open),
			).toBe(true);
		}
		await openBotPanel(page, "tasks");
		await page.locator(".work-filters > summary").click();

		await page.screenshot({ path: evidencePath("gummy-desktop.png") });
		await page.locator("#prompt").fill("Household unsent draft");
		await openBotPanel(page, "conversations");
		await page.locator(`[data-session="${b}"]`).evaluate((element) => {
			(element as HTMLButtonElement).click();
			(element as HTMLButtonElement).click();
		});
		await expect(page.locator(".recipient-label")).toContainText(
			"Learning / Reading time",
		);
		await expect(page.locator("#prompt")).toHaveValue("");
		await openBotPanel(page, "tasks");
		await expect(page.locator("#activity")).not.toContainText("Live weather");
		await openBotPanel(page, "conversations");
		await expect(
			page.getByRole("heading", { name: "Unseen results · 0", exact: true }),
		).toBeVisible();
		await page.locator("#prompt").fill("Learning unsent draft");
		await switchTo("Writing companion");
		await expect(page.locator("#prompt")).toHaveValue("");
		await expect(page.locator(".recipient-label")).toContainText(
			"Writing / First draft",
		);
		await openBotPanel(page, "projects");
		await page.locator("#project-notes-panel > summary").click();
		await openBotPanel(page, "projects");
		await expect(page.locator("#project-notes-panel")).toContainText(
			"Synthetic writing note",
		);
		await openBotPanel(page, "projects");
		await expect(page.locator("#project-notes-panel")).not.toContainText(
			"Synthetic household note",
		);
		await switchTo("Moku");
		await expect(page.locator("#prompt")).toHaveValue("Learning unsent draft");
		await openBotPanel(page, "conversations");
		await page.locator(`[data-session="${a}"]`).click();
		await expect(page.locator("#prompt")).toHaveValue("Household unsent draft");
		await page.locator("#header-appearance").click();
		await page.getByRole("button", { name: "Peach", exact: true }).click();
		await expect(page.locator(".appearance-preview")).toContainText(
			"Peach · Preview",
		);
		await expect(page.locator('[data-color="Peach"]')).toBeFocused();
		await page.getByRole("button", { name: "Cancel", exact: true }).click();
		expect((await snapshot(page)).data.botAppearance).toEqual({
			documents: "Sky",
		});
		await page.locator("#header-appearance").click();
		await page.getByRole("button", { name: "Rose", exact: true }).click();
		await page.keyboard.press("Escape");
		await expect(page.locator("#appearance-dialog")).toHaveCount(0);
		await expect(page.locator("#header-appearance")).toBeFocused();
		await page.locator("#header-appearance").click();
		for (const name of [
			"Peach",
			"Sky",
			"Lavender",
			"Lemon",
			"Rose",
			"Mint ✓",
		]) {
			// Each choice is a preview; it never chooses another Bot.
			const label = name.replace(" ✓", "");
			await page.locator(`[data-color="${label}"]`).click();
			await expect(page.locator(".appearance-preview")).toContainText(
				`${label} · Preview`,
			);
		}
		await page.locator('[data-color="Peach"]').click();
		const geometry = await page
			.locator("#appearance-dialog .gummy")
			.evaluateAll((elements) =>
				elements.map((element) => {
					const wrapper = element.getBoundingClientRect();
					const image = element.querySelector("img") as HTMLImageElement;
					const bounds = image.getBoundingClientRect();
					return {
						width: wrapper.width,
						height: wrapper.height,
						loaded: image.naturalWidth,
						ratio: bounds.width / wrapper.width,
						source: image.getAttribute("src"),
					};
				}),
			);
		expect(geometry).toHaveLength(7);
		for (const [index, image] of geometry.entries()) {
			expect(image.width).toBe(index === 0 ? 144 : 88);
			expect(image.height).toBe(image.width);
			expect(image.loaded).toBe(1536);
			expect(image.ratio).toBeCloseTo(4.096, 2);
			expect(image.source).toBe("assets/gummy-characters.png");
		}

		await page.screenshot({ path: evidencePath("gummy-appearance.png") });
		await page
			.getByRole("button", { name: "Apply color", exact: true })
			.evaluate((element) => {
				(element as HTMLButtonElement).click();
				(element as HTMLButtonElement).click();
			});
		await expect(page.locator("#appearance-dialog")).toHaveCount(0);
		await expect(page.locator(".page-header .gummy")).toHaveClass(/peach/);
		await expect(page.locator("#prompt")).toHaveValue("Household unsent draft");
		await expect(page.locator('[data-bot-unread="moku"]')).toHaveText(
			"1 unseen",
		);
		const before = await snapshot(page);
		expect((before.data.approvalRequests as { id: string }[])[0].id).toBe(
			approval.id,
		);
		const invalid = await page.evaluate(async () => {
			try {
				await window.nest.call("appearance", { id: "moku", color: "Orange" });
				return false;
			} catch {
				return true;
			}
		});
		expect(invalid).toBe(true);
		await page.getByRole("button", { name: "+ Add Bot", exact: true }).click();
		await switchTo("Moku");
		await expect(page.locator("#prompt")).toHaveValue("Household unsent draft");
		await openAppView(page, "Tasks");
		await expect(page.locator(`[id="run-${approval.id}"]`)).toContainText(
			"Approval",
		);
		await switchTo("Moku");
		await page.setViewportSize({ width: 390, height: 900 });
		await page.screenshot({
			path: evidencePath("gummy-narrow.png"),
			fullPage: true,
		});
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth,
			),
		).toBe(true);
		await openBotPanel(page, "conversations");
		await openBotPanel(page, "conversations");
		await page.locator(`[data-session="${b}"]`).click();
		await expect(page.locator(".recipient-label")).toContainText(
			"Learning / Reading time",
		);
		await app.close();
		app = await launch();
		page = await app.firstWindow();
		await expect(page.locator(".page-header h1")).toHaveText("Moku");
		await expect(page.locator(".recipient-label")).toContainText(
			"Learning / Reading time",
		);
		await expect(page.locator(".page-header .gummy")).toHaveClass(/peach/);
		const after = await snapshot(page);
		expect(after.attempts).toHaveLength(before.attempts.length);
		expect((after.data.approvalRequests as { id: string }[])[0].id).toBe(
			approval.id,
		);
		expect(after.data.botAppearance).toEqual({
			documents: "Sky",
			moku: "Peach",
		});
		// Native sends retain the recipient shown after switching; repeated clicks are one receipt.
		for (const [botId, name, sessionId] of [
			["moku", "Moku", b],
			["documents", "Writing companion", c],
		]) {
			await switchTo(name);
			await page.locator("#prompt").fill("What is today's weather?");
			await page.locator("#run").evaluate((element) => {
				(element as HTMLButtonElement).click();
				(element as HTMLButtonElement).click();
			});
			await expect
				.poll(async () => {
					const current = await snapshot(page);
					return (
						current.data.messageReceipts as {
							botId: string;
							sessionId: string;
						}[]
					).filter(
						(receipt) =>
							receipt.botId === botId && receipt.sessionId === sessionId,
					).length;
				})
				.toBe(1);
		}
		const final = await snapshot(page);
		expect(final.data.messageReceipts as unknown[]).toHaveLength(3);
		expect((final.data.approvalRequests as { id: string }[])[0].id).toBe(
			approval.id,
		);
	} finally {
		await app.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
