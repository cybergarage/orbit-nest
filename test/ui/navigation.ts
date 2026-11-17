import type { Page } from "@playwright/test";
export async function openContextTools(page: Page): Promise<void> {
	await openBotPanel(page, "projects");
	const tools = page.locator(".context-tools");
	if (
		!(await tools.evaluate((element) => (element as HTMLDetailsElement).open))
	)
		await tools.locator("summary").first().click();
}

export async function openInputReceipts(page: Page): Promise<void> {
	await openBotPanel(page, "conversations");
	const panel = page.locator("#input-receipts-panel");
	if (
		!(await panel.evaluate((element) => (element as HTMLDetailsElement).open))
	)
		await panel.locator("summary").first().click();
}

export async function openBotPanel(page: Page, name: string): Promise<void> {
	if (!(await page.locator("#bot-panel").count())) return;
	const panel = page.locator(`[data-panel-content="${name}"]`);
	if (await panel.isVisible()) return;
	await page.locator(".bot-row.selected [data-bot-menu]").click();
	await page.locator(`.bot-menu [data-panel="${name}"]`).click();
}
export async function openAppView(page: Page, name: string): Promise<void> {
	await page.getByRole("button", { name: "App settings", exact: true }).click();
	await page.getByRole("button", { name, exact: true }).click();
}
