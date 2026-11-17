import { openBotPanel, openAppView } from "./navigation";
import { evidencePath } from "./evidence";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import type { WorkState } from "@cybergarage/orbit/dist/core/execution/scheduled-work.js";
import { Runtime } from "../../src/runtime";
import type { ApprovalRequest } from "../../src/approval-answers";

for (const outcome of ["approve", "reject", "interrupted"] as const) {
	test(`local approval UI ${outcome} survives repeated delivery and relaunch`, async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-answer-ui-"));
		const fixture = new Runtime(
			path.join(root, "work.json"),
			undefined,
			undefined,
			(stage) => {
				if (outcome === "interrupted" && stage === "accepted")
					throw Error("Synthetic host interruption");
			},
		);
		const id = fixture.store.enqueue("synthetic-ui-answer", {
			botId: "documents",
			prompt: "Synthetic answer fixture",
		});
		const attempt = fixture.store.claim(id);
		fixture.store.finish(id, attempt.id, "succeeded", "Synthetic UI memory");
		fixture.remember(id);
		const request = fixture.approvalRequests()[0];
		expect(request).toBeTruthy();
		const input = { ...request, allow: outcome !== "reject" };
		if (outcome === "interrupted")
			expect(() => fixture.answerApproval(input)).toThrow(/interruption/);
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
			await openAppView(page, "Tasks");
			if (outcome !== "interrupted") {
				// A missing correlation token from even the trusted renderer is rejected.
				const invalid = await page.evaluate(async (id) => {
					try {
						await window.nest.call("approve", { id, allow: true });
						return false;
					} catch {
						return true;
					}
				}, request.id);
				expect(invalid).toBe(true);
				if (outcome === "approve")
					await page.screenshot({
						path: evidencePath("local-approval-answer.png"),
						fullPage: true,
					});
				await openBotPanel(page, "tasks");
				await page
					.getByRole("button", {
						name:
							outcome === "reject" ? "Reject" : "Approve memory replacement",
						exact: true,
					})
					.click();
			}
			const status = outcome === "reject" ? "cancelled" : "succeeded";
			await expect
				.poll(async () => {
					const state = (await page.evaluate(() =>
						window.nest.call("state"),
					)) as WorkState;
					return state.runs.find((run) => run.id === request.id)?.status;
				})
				.toBe(status);
			const before = (await page.evaluate(() =>
				window.nest.call("state"),
			)) as WorkState;
			for (let i = 0; i < 2; i++)
				await page.evaluate(
					(input) => window.nest.call("approve", input),
					input,
				);
			await app.close();
			app = await launch();
			page = await app.firstWindow();
			await page.evaluate((input) => window.nest.call("approve", input), input);
			const after = (await page.evaluate(() =>
				window.nest.call("state"),
			)) as WorkState;
			expect(after.attempts).toHaveLength(before.attempts.length);
			expect(after.runs.find((run) => run.id === request.id)?.status).toBe(
				status,
			);
			const bot = (after.data.bots as { id: string; memory: string }[]).find(
				(bot) => bot.id === "documents",
			);
			expect(bot?.memory).toBe(
				outcome === "reject" ? "" : "Synthetic UI memory",
			);
			const pending = after.data.approvalRequests as ApprovalRequest[];
			expect(pending).toHaveLength(0);
		} finally {
			await app.close();
			await fs.rm(root, { recursive: true, force: true });
		}
	});
}
