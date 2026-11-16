import { evidencePath } from "./evidence";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

test("native Project catalog, scoped notes and Session results survive desktop restart", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-project-ui-"));
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
		await page.getByRole("button", { name: "◈ Research companion" }).click();
		await page
			.getByText("Create Project or conversation", { exact: true })
			.click();
		await page.getByLabel("New Project name", { exact: true }).fill("Alpha");
		await page
			.getByRole("button", { name: "Create Project", exact: true })
			.click();
		await expect(page.locator("#conversation-project option")).toHaveCount(1);
		await page
			.getByText("Create Project or conversation", { exact: true })
			.click();
		await page
			.getByLabel("New conversation name", { exact: true })
			.fill("Alpha chat");
		await page
			.getByRole("button", { name: "Create conversation", exact: true })
			.click();
		await expect(page.locator("#context-session option")).toHaveCount(2);
		const alpha = await page
			.locator("#context-session option")
			.nth(1)
			.getAttribute("value");
		expect(alpha).toBeTruthy();
		await page
			.getByLabel("Conversation context", { exact: true })
			.selectOption(alpha ?? "");
		await expect(
			page.getByText(
				"Only this conversation and its Project notes reach the local model.",
				{ exact: false },
			),
		).toBeVisible();
		await page.getByText("Project notes", { exact: true }).click();
		await page
			.getByLabel("New Project note", { exact: true })
			.fill("Alpha synthetic private note");
		await page
			.getByRole("button", { name: "Save Project note", exact: true })
			.click();
		await page.getByText("Project notes", { exact: true }).click();
		await expect(
			page.getByText("Alpha synthetic private note", { exact: true }),
		).toBeVisible();
		await page
			.getByText("Create Project or conversation", { exact: true })
			.click();
		await page.getByLabel("New Project name", { exact: true }).fill("Beta");
		await page
			.getByRole("button", { name: "Create Project", exact: true })
			.click();
		await expect(page.locator("#conversation-project option")).toHaveCount(2);
		await page
			.getByText("Create Project or conversation", { exact: true })
			.click();
		await page
			.getByLabel("Project for new conversation")
			.selectOption({ label: "Beta" });
		await page
			.getByLabel("New conversation name", { exact: true })
			.fill("Beta chat");
		await page
			.getByRole("button", { name: "Create conversation", exact: true })
			.click();
		await expect(page.locator("#context-session option")).toHaveCount(3);
		const beta = await page
			.locator("#context-session option")
			.filter({ hasText: "Beta / Beta chat" })
			.getAttribute("value");
		await page
			.getByLabel("Conversation context", { exact: true })
			.selectOption(beta ?? "");
		await expect(
			page.getByText("Alpha synthetic private note", { exact: true }),
		).toHaveCount(0);
		await page.locator("#prompt").fill("What is today's weather?");
		await page.getByRole("button", { name: "Send", exact: true }).click();
		await expect(
			page
				.locator("#activity")
				.getByText(/Live weather lookup is not available/),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Unseen results · 1", exact: true }),
		).toBeVisible();
		await page.screenshot({
			path: evidencePath("local-result-notifications.png"),
			fullPage: true,
		});
		for (let i = 0; i < 3; i++) {
			await page
				.getByLabel("Conversation context", { exact: true })
				.selectOption(alpha ?? "");
			await expect(
				page.getByRole("heading", { name: "Unseen results · 0", exact: true }),
			).toBeVisible();
			await expect(
				page
					.locator("#activity")
					.getByText(/Live weather lookup is not available/),
			).toHaveCount(0);
			await expect(
				page
					.locator("#context-session option")
					.filter({ hasText: "Beta / Beta chat · 1 unseen" }),
			).toHaveCount(1);
			await page
				.getByLabel("Conversation context", { exact: true })
				.selectOption(beta ?? "");
			await expect(
				page.getByRole("heading", { name: "Unseen results · 1", exact: true }),
			).toBeVisible();
		}
		await app.close();
		app = await launch();
		page = await app.firstWindow();
		await page.getByRole("button", { name: "◈ Research companion" }).click();
		await expect(
			page.getByLabel("Conversation context", { exact: true }),
		).toHaveValue(beta ?? "");
		await expect(
			page
				.locator("#activity")
				.getByText(/Live weather lookup is not available/),
		).toBeVisible();
		await page
			.getByLabel("Conversation context", { exact: true })
			.selectOption(alpha ?? "");
		await page.getByText("Project notes", { exact: true }).click();
		await expect(
			page.getByText("Alpha synthetic private note", { exact: true }),
		).toBeVisible();
		await expect(
			page
				.locator("#activity")
				.getByText(/Live weather lookup is not available/),
		).toHaveCount(0);
		await page
			.getByLabel("Conversation context", { exact: true })
			.selectOption(beta ?? "");
		await page
			.getByRole("button", { name: "Mark result read", exact: true })
			.click();
		await expect(
			page.getByRole("heading", { name: "Unseen results · 0", exact: true }),
		).toBeVisible();
		await app.close();
		app = await launch();
		page = await app.firstWindow();
		await page.getByRole("button", { name: "◈ Research companion" }).click();
		await expect(
			page.getByRole("heading", { name: "Unseen results · 0", exact: true }),
		).toBeVisible();
		await expect(page.locator("#activity .result")).toHaveCount(1);
		const denied = await page.evaluate(async (sessionId) => {
			try {
				await window.nest.call("context-select", {
					id: "documents",
					sessionId,
				});
				return false;
			} catch {
				return true;
			}
		}, alpha);
		expect(denied).toBe(true);
	} finally {
		await app.close();
		await fs.rm(root, { recursive: true, force: true });
	}
});
