import { openContextTools } from "./navigation";
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
import type { NotesInspection } from "../../src/project-notes";
import { evidencePath } from "./evidence";

async function openNotes(page: Page) {
	const panel = page.locator("#project-notes-panel");
	await expect(panel).toBeVisible();
	if (
		!(await panel.evaluate((element) => (element as HTMLDetailsElement).open))
	)
		await panel.locator("summary").first().click();
	return panel;
}
async function inspection(page: Page): Promise<NotesInspection> {
	const state = (await page.evaluate(() =>
		window.nest.call("state"),
	)) as WorkState;
	return (state.data.contextViews as Record<string, NotesInspection>).research;
}
async function fixture(history = false) {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-note-ui-"));
	const runtime = new Runtime(path.join(root, "work.json"));
	const context = await ProjectContext.open(
		path.join(root, "context"),
		runtime,
	);
	runtime.context = context;
	const alpha = randomUUID(),
		beta = randomUUID(),
		a1 = randomUUID(),
		a2 = randomUUID(),
		b1 = randomUUID(),
		noteId = randomUUID();
	await context.createProject("research", "Synthetic Alpha", alpha);
	await context.createProject("research", "Synthetic Beta", beta);
	await context.createSession("research", alpha, "Alpha first", a1);
	await context.createSession("research", alpha, "Alpha second", a2);
	await context.createSession("research", beta, "Beta first", b1);
	await context.select("research", a1);
	await context.addMemory("research", "Alpha original note", noteId, a1);
	if (history)
		for (let index = 0; index < 51; index++) {
			const id = randomUUID();
			await context.memory.create(alpha, {
				operationId: id,
				title: "Inactive fixture",
				body: `Inactive Alpha fixture ${index}`,
			});
			await context.memory.edit(alpha, id, {
				operationId: randomUUID(),
				expectedRevision: 1,
				title: "Inactive fixture",
				body: `Inactive Alpha fixture ${index}`,
				retired: true,
			});
		}
	await context.select("research", b1);
	await context.addMemory("research", "Beta private note", randomUUID(), b1);
	await context.select("research", a1);
	await runtime.close();
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
	return { root, launch, a1, a2, b1, noteId };
}

test("Project note correction, cancellation, deactivation, history, context evidence and switching survive restart", async () => {
	const data = await fixture(true);
	let app = await data.launch();
	try {
		let page = await app.firstWindow();
		await page
			.getByRole("button", { name: "Switch to Research companion" })
			.click();
		await openContextTools(page);
		let panel = await openNotes(page);
		const row = () => page.locator(`[data-project-note="${data.noteId}"]`);
		await row()
			.getByRole("button", { name: "Correct note", exact: true })
			.click();
		await page.getByLabel("Corrected note text").fill("Cancelled draft");
		await page
			.getByRole("button", { name: "Cancel note change", exact: true })
			.click();
		expect((await inspection(page)).notes[0].body).toBe("Alpha original note");
		panel = await openNotes(page);
		await row()
			.getByRole("button", { name: "Correct note", exact: true })
			.click();
		await page.getByLabel("Corrected note text").fill("Alpha corrected note");
		await page
			.getByRole("button", { name: "Save correction", exact: true })
			.evaluate((element) => {
				(element as HTMLButtonElement).click();
				(element as HTMLButtonElement).click();
			});
		await expect
			.poll(async () => (await inspection(page)).notes[0]?.revision)
			.toBe(2);
		panel = await openNotes(page);
		await expect(row()).toContainText("Alpha corrected note");
		await expect(row()).toContainText("Included in current note preview");
		await panel
			.getByText("Current Project note context", { exact: true })
			.click();
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.screenshot({
			path: evidencePath("project-notes.png"),
			fullPage: true,
		});
		await page.locator("#prompt").fill("What is today's weather?");
		await page.getByRole("button", { name: "Send", exact: true }).click();
		await expect(
			page
				.locator("#activity")
				.getByText("Captured Project note context", { exact: true }),
		).toBeVisible();
		await page
			.locator("#activity")
			.getByText("Captured Project note context", { exact: true })
			.click();
		await expect(page.locator("#activity")).toContainText(
			"Alpha corrected note",
		);
		panel = await openNotes(page);
		await row()
			.getByRole("button", { name: "Deactivate note", exact: true })
			.click();
		await page
			.getByRole("button", { name: "Cancel note change", exact: true })
			.click();
		expect((await inspection(page)).notes).toHaveLength(1);
		panel = await openNotes(page);
		await row()
			.getByRole("button", { name: "Deactivate note", exact: true })
			.click();
		await page
			.getByRole("button", { name: "Confirm deactivate", exact: true })
			.click();
		await expect
			.poll(async () => (await inspection(page)).notes.length)
			.toBe(0);
		panel = await openNotes(page);
		await panel.getByText("Inactive notes", { exact: true }).click();
		await expect(
			page.locator("#inactive-project-notes [data-project-note]"),
		).toHaveCount(50);
		await page
			.getByRole("button", { name: "Next inactive notes", exact: true })
			.click();
		await expect(
			page.locator("#inactive-project-notes [data-project-note]"),
		).toHaveCount(2);
		await page
			.getByRole("button", { name: "First inactive notes", exact: true })
			.click();
		await expect(
			page.locator("#inactive-project-notes [data-project-note]"),
		).toHaveCount(50);
		await page
			.getByLabel("Conversation context", { exact: true })
			.selectOption(data.a2);
		expect((await inspection(page)).preview?.entries).toHaveLength(0);
		await page
			.getByLabel("Conversation context", { exact: true })
			.selectOption(data.b1);
		panel = await openNotes(page);
		await expect(panel).toContainText("Beta private note");
		await expect(panel).not.toContainText("Alpha corrected note");
		await page
			.getByLabel("Conversation context", { exact: true })
			.selectOption(data.a1);
		await app.close();
		app = await data.launch();
		page = await app.firstWindow();
		await page
			.getByRole("button", { name: "Switch to Research companion" })
			.click();
		await openContextTools(page);
		const restored = await inspection(page);
		expect(restored.notes).toHaveLength(0);
		expect(restored.preview?.entries).toHaveLength(0);
		await page
			.locator("#activity")
			.getByText("Captured Project note context", { exact: true })
			.click();
		await expect(page.locator("#activity")).toContainText(
			"Alpha corrected note",
		);
	} finally {
		await app.close();
		await fs.rm(data.root, { recursive: true, force: true });
	}
});

test("stale note drafts stay local and repeated native commands cannot overwrite a later correction", async () => {
	const data = await fixture();
	let app = await data.launch();
	try {
		let page = await app.firstWindow();
		await page
			.getByRole("button", { name: "Switch to Research companion" })
			.click();
		await openContextTools(page);
		await openNotes(page);
		await page
			.getByRole("button", { name: "Correct note", exact: true })
			.click();
		await page.getByLabel("Corrected note text").fill("Unsaved stale draft");
		const before = await inspection(page);
		expect(before.target).toBeTruthy();
		expect(before.preview).toBeTruthy();
		const input = {
			id: "research",
			target: before.target,
			generation: before.preview?.generation,
			noteId: data.noteId,
			expectedRevision: before.notes[0].revision,
			operationId: randomUUID(),
			action: "correct",
			body: "Concurrent saved correction",
		};
		await page.evaluate(
			(input) => window.nest.call("project-note-change", input),
			input,
		);
		await expect(page.getByLabel("Corrected note text")).toHaveValue(
			"Unsaved stale draft",
		);
		await page
			.getByRole("button", { name: "Save correction", exact: true })
			.click();
		await expect(page.getByRole("alert")).toContainText("changed");
		await expect(page.getByLabel("Corrected note text")).toHaveValue(
			"Unsaved stale draft",
		);
		expect((await inspection(page)).notes[0].body).toBe(
			"Concurrent saved correction",
		);
		await page
			.getByRole("button", { name: "Cancel note change", exact: true })
			.click();
		await openNotes(page);
		await page
			.getByRole("button", { name: "Correct note", exact: true })
			.click();
		await page
			.getByLabel("Corrected note text")
			.fill("Alpha-only unsaved draft");
		await page
			.getByLabel("Conversation context", { exact: true })
			.selectOption(data.b1);
		const panel = await openNotes(page);
		await expect(panel).not.toContainText("Alpha-only unsaved draft");
		await expect(panel).toContainText("Beta private note");
		await page
			.getByLabel("Conversation context", { exact: true })
			.selectOption(data.a1);
		await expect(page.getByLabel("Corrected note text")).toHaveValue(
			"Alpha-only unsaved draft",
		);
		await page
			.getByRole("button", { name: "Cancel note change", exact: true })
			.click();
		await page.evaluate(
			(input) => window.nest.call("project-note-change", input),
			input,
		);
		expect((await inspection(page)).notes[0].revision).toBe(2);
		await openNotes(page);
		await page
			.getByRole("button", { name: "Deactivate note", exact: true })
			.click();
		await page
			.getByRole("button", { name: "Confirm deactivate", exact: true })
			.click();
		await expect
			.poll(async () => (await inspection(page)).notes.length)
			.toBe(0);
		const inactivePanel = await openNotes(page);
		await inactivePanel.getByText("Inactive notes", { exact: true }).click();
		await page
			.locator("#inactive-project-notes")
			.getByRole("button", { name: "Correct note", exact: true })
			.click();
		await page
			.getByLabel("Corrected note text")
			.fill("Inactive saved correction");
		await page
			.getByRole("button", { name: "Save correction", exact: true })
			.click();
		await expect
			.poll(async () => (await inspection(page)).inactive[0]?.revision)
			.toBe(4);

		await app.close();
		app = await data.launch();
		page = await app.firstWindow();
		await page.evaluate(
			(input) => window.nest.call("project-note-change", input),
			input,
		);
		const restored = await inspection(page);
		expect(restored.notes).toHaveLength(0);
		expect(restored.inactive[0].revision).toBe(4);
		expect(restored.inactive[0].retired).toBe(true);
		expect(restored.inactive[0].body).toBe("Inactive saved correction");
	} finally {
		await app.close();
		await fs.rm(data.root, { recursive: true, force: true });
	}
});
