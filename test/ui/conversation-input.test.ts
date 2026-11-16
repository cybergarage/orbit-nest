import { openContextTools, openInputReceipts } from "./navigation";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { _electron as electron, expect, test } from "@playwright/test";
import type { WorkState } from "@cybergarage/orbit/dist/core/execution/scheduled-work.js";
import { Runtime } from "../../src/runtime";
import { ProjectContext } from "../../src/project-context";
import type { MessageReceipt } from "../../src/conversation-input";

for (const scoped of [false, true]) {
	test(`local ${scoped ? "Project" : "legacy"} input receipt survives unconfirmed send, repeated receipt checks and restart`, async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-input-ui-"));
		const fixture = new Runtime(path.join(root, "work.json"));
		let sessionId = "",
			otherSessionId = "";
		if (scoped) {
			fixture.context = await ProjectContext.open(
				path.join(root, "context"),
				fixture,
			);
			const projectId = randomUUID();
			sessionId = randomUUID();
			otherSessionId = randomUUID();
			await fixture.context.createProject(
				"research",
				"Synthetic input Project",
				projectId,
			);
			await fixture.context.createSession(
				"research",
				projectId,
				"Original conversation",
				sessionId,
			);
			await fixture.context.createSession(
				"research",
				projectId,
				"Other conversation",
				otherSessionId,
			);
			await fixture.context.select("research", sessionId);
		}
		const pending = {
			id: "research",
			prompt: "What is today's weather?",
			requestId: "synthetic-unconfirmed",
			sessionId,
		};
		await fixture.chat(
			pending.id,
			pending.prompt,
			pending.requestId,
			pending.sessionId,
		);
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
			await page
				.getByRole("button", { name: "Switch to Research companion" })
				.click();
			await openContextTools(page);
			await openInputReceipts(page);
			await expect(
				page
					.getByRole("region", { name: "Received local inputs" })
					.getByText("Input: Result saved", { exact: true }),
			).toBeVisible();
			// The accepted main-process call lost its UI acknowledgement. The original
			// envelope survives locally; reload must not resend or choose another Session.
			await page.evaluate(
				(input) =>
					localStorage.setItem(
						"nest-unconfirmed-local-inputs-v1",
						JSON.stringify([input]),
					),
				pending,
			);
			if (scoped)
				await page
					.getByLabel("Conversation context", { exact: true })
					.selectOption(otherSessionId);
			await app.close();
			app = await launch();
			page = await app.firstWindow();
			await page
				.getByRole("button", { name: "Switch to Research companion" })
				.click();
			await openContextTools(page);
			await openInputReceipts(page);
			if (scoped) {
				await expect(
					page.getByRole("button", { name: "Check saved send receipt" }),
				).toHaveCount(0);
				await expect(
					page
						.getByRole("region", { name: "Received local inputs" })
						.getByText(pending.prompt, { exact: true }),
				).toHaveCount(0);
				await page
					.getByLabel("Conversation context", { exact: true })
					.selectOption(sessionId);
			}
			const retry = page.getByRole("button", {
				name: "Check saved send receipt",
			});
			await expect(retry).toBeVisible();
			await retry.click();
			await expect(retry).toHaveCount(0);
			const snapshot = (await page.evaluate(() =>
				window.nest.call("state"),
			)) as WorkState;
			expect(snapshot.runs).toHaveLength(1);
			expect(snapshot.attempts).toHaveLength(1);
			expect(
				(snapshot.data.messageReceipts as MessageReceipt[])[0].sessionId,
			).toBe(sessionId);
			const invalid = await page.evaluate(async (input) => {
				try {
					await window.nest.call("chat", {
						...input,
						prompt: "Conflicting text",
					});
					return false;
				} catch {
					return true;
				}
			}, pending);
			expect(invalid).toBe(true);
			await page.evaluate((input) => window.nest.call("chat", input), pending);
			const unchanged = (await page.evaluate(() =>
				window.nest.call("state"),
			)) as WorkState;
			expect(unchanged.attempts).toHaveLength(1);
			await page.locator("#prompt").fill("   ");
			await page.getByRole("button", { name: "Send", exact: true }).click();
			await expect(page.getByRole("alert")).toContainText("Enter a message");
			await page.locator("#prompt").fill("What is tomorrow's weather?");
			await page.getByRole("button", { name: "Send", exact: true }).click();
			await expect(page.locator("#prompt")).toHaveValue("");
			await expect
				.poll(async () => {
					const state = (await page.evaluate(() =>
						window.nest.call("state"),
					)) as WorkState;
					return (state.data.messageReceipts as MessageReceipt[]).filter(
						(message) => message.status === "result-saved",
					).length;
				})
				.toBe(2);
			await app.close();
			app = await launch();
			page = await app.firstWindow();
			const final = (await page.evaluate(() =>
				window.nest.call("state"),
			)) as WorkState;
			expect(final.runs).toHaveLength(2);
			expect(final.attempts).toHaveLength(2);
		} finally {
			await app.close();
			await fs.rm(root, { recursive: true, force: true });
		}
	});
}
