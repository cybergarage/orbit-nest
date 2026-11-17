import { CHARACTER_COLORS, type CharacterColor } from "./appearance";
import type { Bot } from "./runtime";
const htmlText = (text: string): string =>
	text.replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				c
			] ?? c,
	);
export function characterAvatar(color: CharacterColor, large = false): string {
	return `<span class="portrait gummy ${color.toLowerCase()} ${large ? "large" : ""}" aria-hidden="true"><img src="assets/gummy-characters.png" alt=""></span>`;
}
export function characterRail(
	bots: Bot[],
	selected: string,
	color: (id: string) => CharacterColor,
	unseen: (id: string) => number,
): string {
	const buttons = bots
		.slice()
		.sort(
			(a, b) => Number(b.template === "moku") - Number(a.template === "moku"),
		)
		.map((bot) => {
			const count = unseen(bot.id);
			let label = selected === bot.id ? "Selected" : "";
			if (count) label = `${count} unseen`;
			return `<div class="bot-row ${selected === bot.id ? "selected" : ""}"><button class="character-switch" data-view="${htmlText(bot.id)}" aria-label="Switch to ${htmlText(bot.name)}" aria-pressed="${selected === bot.id}">${characterAvatar(color(bot.id))}<span class="bot-identity"><strong>${htmlText(bot.name)}</strong><small data-bot-unread="${htmlText(bot.id)}">${label}</small></span></button><button id="bot-menu-${htmlText(bot.id)}" class="bot-more text-button" data-bot-menu="${htmlText(bot.id)}" aria-haspopup="menu" aria-label="${htmlText(bot.name)} menu">…</button></div>`;
		})
		.join("");
	return `<nav class="character-rail" aria-label="Your characters"><div class="bot-list">${buttons}</div><div class="rail-footer"><button class="text-button" data-view="library">+ Add Bot</button><button class="text-button app-settings" data-view="settings">App settings</button></div></nav>`;
}
export function appearanceMarkup(
	bot: Bot,
	color: CharacterColor,
	busy: boolean,
	error = "",
): string {
	const alert = error
		? `<p role="alert" class="error">${htmlText(error)}</p>`
		: "";
	const choices = CHARACTER_COLORS.map((choice) => {
		const mark = choice === color ? " ✓" : "";
		return `<button class="color-choice" data-color="${choice}" aria-pressed="${choice === color}" ${busy ? "disabled" : ""}>${characterAvatar(choice)}<span>${choice}${mark}</span></button>`;
	}).join("");
	return `<dialog id="appearance-dialog" aria-labelledby="appearance-heading">${alert}<h2 id="appearance-heading">Make ${htmlText(bot.name)} yours</h2><p>One companion. A color that feels like you.</p><div class="appearance-preview">${characterAvatar(color, true)}<strong>${color} · Preview</strong></div><div class="color-choices" role="group" aria-label="Character color">${choices}</div><p class="muted">Appearance only for ${htmlText(bot.name)}. Memory, Projects, permissions and model stay as they are.</p><div class="appearance-actions"><button id="appearance-cancel" class="secondary" ${busy ? "disabled" : ""}>Cancel</button><button id="appearance-apply" ${busy ? "disabled" : ""}>Apply color</button></div></dialog>`;
}
