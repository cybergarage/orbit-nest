import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { Runtime } from "../../src/runtime";

test("2D board uses receipts, preserves unknown work, scopes stop, previews repeated clicks and fits narrow screens", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-board-ui-"));
	const fixture = new Runtime(path.join(root, "work.json"));
	const saved = fixture.store.enqueue("saved", {
		kind: "chat",
		botId: "documents",
		prompt: "Synthetic manuscript review",
	});
	const a = fixture.store.claim(saved);
	fixture.store.finish(
		saved,
		a.id,
		"succeeded",
		"Synthetic persisted result: clarify the harbor scene.",
	);
	fixture.remember(saved);
	const research = fixture.store.enqueue(
		"research-memory",
		{
			kind: "memory",
			botId: "research",
			expectedMemory: "",
			text: "Synthetic research memory",
		},
		"opaque",
		"Replace Research companion memory with synthetic notes.",
	);
	const failed = fixture.store.enqueue("failed", {
		kind: "chat",
		botId: "research",
		prompt: "Synthetic failed task",
	});
	const f = fixture.store.claim(failed);
	fixture.store.finish(
		failed,
		f.id,
		"failed",
		"Completed the review (untrusted wording in a failed record)",
	);
	const unknown = fixture.store.enqueue(
		"unknown",
		{ kind: "memory", botId: "research" },
		"opaque",
	);
	const u = fixture.store.claim(unknown);
	fixture.store.finish(
		unknown,
		u.id,
		"unknown",
		"Synthetic interrupted effect; outcome unresolved.",
	);
	const cancelled = fixture.store.enqueue("cancelled", {
		kind: "chat",
		botId: "documents",
		prompt: "Synthetic cancelled task",
	});
	fixture.cancel(cancelled);
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
	try {
		let page = await app.firstWindow();
		await expect(
			page
				.locator(`#run-${saved}`)
				.getByText("Saved result receipt", { exact: true }),
		).toBeVisible();
		await expect(
			page.locator(`#run-${failed}`).getByText("Failed", { exact: true }),
		).toBeVisible();
		await expect(
			page
				.locator(`#run-${failed}`)
				.getByText("Saved result receipt", { exact: true }),
		).toHaveCount(0);
		await page
			.getByRole("button", { name: "Open saved result", exact: true })
			.click();
		await expect(page.locator(`#run-${saved}`)).toBeFocused();
		await page.getByRole("button", { name: "Failed (1)", exact: true }).focus();
		await page.keyboard.press("Enter");
		await expect(page.locator("#activity .result")).toHaveCount(1);
		await expect(page.locator(`#run-${failed}`)).toBeVisible();
		await page
			.getByRole("button", { name: "All work (6)", exact: true })
			.click();
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.screenshot({
			path: "evidence/workflow-board.png",
			fullPage: true,
		});
		await page
			.locator(".companion-card")
			.filter({
				has: page.getByRole("heading", {
					name: "Research companion",
					exact: true,
				}),
			})
			.getByRole("button", { name: "Stop this Companion" })
			.click();
		const stopped = (await page.evaluate(() => window.nest.call("state"))) as {
			runs: { id: string; status: string }[];
		};
		expect(stopped.runs.find((r) => r.id === research)?.status).toBe(
			"cancelled",
		);
		expect(stopped.runs.find((r) => r.id === unknown)?.status).toBe("unknown");
		expect(stopped.runs.filter((r) => r.status === "approval")).toHaveLength(1);
		await app.close();
		app = await launch();
		page = await app.firstWindow();
		await expect(
			page
				.locator(`#run-${unknown}`)
				.getByText("Unknown / interrupted", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByRole("button", {
				name: "Approve memory replacement",
				exact: true,
			}),
		).toHaveCount(1);
		await page.getByRole("button", { name: "◈ Research companion" }).click();
		await page.locator("#prompt").fill("明日の天気は？");
		await expect(
			page.getByRole("button", { name: "Send", exact: true }),
		).toBeDisabled();
		await page.getByRole("button", { name: "Preview task" }).click();
		await expect(
			page.getByText("Proposal · not submitted", { exact: true }),
		).toBeVisible();
		const before = (await page.evaluate(() => window.nest.call("state"))) as {
			runs: unknown[];
		};
		expect(before.runs).toHaveLength(6);
		await page.evaluate(async () => {
			const state = (await window.nest.call("state")) as unknown as {
				data: {
					bots: {
						id: string;
						name: string;
						role: string;
						memory: string;
						tone?: string;
						profileRevision: number;
					}[];
				};
			};
			const bot = state.data.bots.find((b) => b.id === "research");
			if (!bot) throw Error("Missing fixture Companion");
			await window.nest.call("save", { ...bot, tone: "A new saved tone" });
		});
		await page.getByRole("button", { name: "Send", exact: true }).click();
		await expect(page.getByRole("alert")).toContainText("changed");
		await expect(
			page.getByRole("button", { name: "Send", exact: true }),
		).toBeDisabled();
		const stale = (await page.evaluate(() => window.nest.call("state"))) as {
			runs: unknown[];
		};
		expect(stale.runs).toHaveLength(6);
		await page.getByRole("button", { name: "Preview task" }).click();
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.screenshot({
			path: "evidence/workflow-preview.png",
			fullPage: true,
		});
		await page.locator("#run").evaluate((e) => {
			(e as HTMLButtonElement).click();
			(e as HTMLButtonElement).click();
		});
		await expect(
			page
				.locator("#activity")
				.getByText(/Live weather lookup is not available/),
		).toBeVisible();
		const after = (await page.evaluate(() => window.nest.call("state"))) as {
			runs: unknown[];
		};
		expect(after.runs).toHaveLength(7);
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
		await page.screenshot({
			path: "evidence/workflow-narrow.png",
			fullPage: true,
		});
	} finally {
		await app.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
