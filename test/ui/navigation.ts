import type { Page } from "@playwright/test";
export async function openContextTools(page: Page): Promise<void> {
	const tools = page.locator(".context-tools");
	if (
		!(await tools.evaluate((element) => (element as HTMLDetailsElement).open))
	)
		await tools.locator("summary").first().click();
}

export async function openInputReceipts(page: Page): Promise<void> {
	const panel = page.locator("#input-receipts-panel");
	if (
		!(await panel.evaluate((element) => (element as HTMLDetailsElement).open))
	)
		await panel.locator("summary").first().click();
}
