// Pure helpers and constants for /newpoll. Kept separate from +page.server.ts
// so tests can import them without pulling in $lib aliases / SvelteKit runtime.

export const POLL_OPTION_MIN = 2;
export const POLL_OPTION_MAX = 10;
export const POLL_OPTION_TEXT_MAX = 300;
export const POLL_TITLE_MAX = 80;
export const POLL_TEXT_MAX = 4000;

// 改行区切り入力を選択肢配列に変換する。trim → 空行除外。
// 本家HN の textarea は「blank lines OK between」と案内しているため空行は無視する。
export function parsePollOptions(raw: string): string[] {
	return raw
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}
