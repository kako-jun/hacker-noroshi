/**
 * HN-compatible text formatting.
 * - Auto-link URLs (before HTML escape to preserve original URLs)
 * - HTML escape non-URL parts (XSS prevention)
 * - *italic* conversion
 */

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#x27;');
}

function italicize(text: string): string {
	// Match *text* where:
	// - Opening * is at start of string or preceded by whitespace
	// - Closing * is at end of string or followed by whitespace/punctuation
	// - Content is non-empty and doesn't contain *
	return text.replace(
		/(^|\s)\*([^\s*][^*]*[^\s*]|[^\s*])\*(?=\s|$|[.,;:!?)])/g,
		'$1<i>$2</i>'
	);
}

/**
 * 削除済みユーザー (users.deleted = 1) の username 表示は [deleted] に置換する。
 * 投稿・コメント自体はスレッド整合性のため保持されるが、紐づく username は伏せる。
 * SQL 側で CASE 置換せず、クライアント表示時に一貫してこのヘルパを通すことで
 * カラム漏れによる本名漏洩を防ぐ。本家HN FAQ #32 相当の挙動。
 */
export function displayUsername(user: { username: string; deleted?: number | null }): string {
	return user.deleted ? '[deleted]' : user.username;
}

export function formatText(text: string): string {
	// Split text into URL and non-URL segments.
	// Process URLs before HTML escape to preserve original href values.
	const urlPattern = /https?:\/\/[^\s<>]*/g;
	const parts: string[] = [];
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = urlPattern.exec(text)) !== null) {
		// Escape non-URL text before this match
		if (match.index > lastIndex) {
			parts.push(escapeHtml(text.slice(lastIndex, match.index)));
		}

		// Strip trailing punctuation from URL
		let url = match[0];
		const trailingMatch = url.match(/[.,;:!?)\]]+$/);
		let trailing = '';
		if (trailingMatch) {
			trailing = trailingMatch[0];
			url = url.slice(0, -trailing.length);
		}

		parts.push(`<a href="${url}" rel="nofollow noreferrer">${escapeHtml(url)}</a>`);
		if (trailing) {
			parts.push(escapeHtml(trailing));
		}

		lastIndex = match.index + match[0].length;
	}

	// Escape remaining non-URL text
	if (lastIndex < text.length) {
		parts.push(escapeHtml(text.slice(lastIndex)));
	}

	let result = parts.join('');
	result = italicize(result);
	return result;
}
