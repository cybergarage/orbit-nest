export const CHARACTER_COLORS = [
	"Mint",
	"Peach",
	"Sky",
	"Lavender",
	"Lemon",
	"Rose",
] as const;
export type CharacterColor = (typeof CHARACTER_COLORS)[number];
export function isCharacterColor(value: unknown): value is CharacterColor {
	return (
		typeof value === "string" &&
		(CHARACTER_COLORS as readonly string[]).includes(value)
	);
}
export function characterColor(data: unknown, botId: string): CharacterColor {
	const value = (data as Record<string, unknown> | undefined)?.[botId];
	return isCharacterColor(value) ? value : "Mint";
}
