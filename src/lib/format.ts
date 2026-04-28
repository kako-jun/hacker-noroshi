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
export function displayUsername(user: { username: string; deleted?: 0 | 1 | null | undefined }): string {
	return user.deleted ? '[deleted]' : user.username;
}

/**
 * 現在時刻を ISO8601 (秒精度、末尾 Z) で返す。
 * `new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')` の重複を共通化したもの。
 * D1 の TEXT カラム（schema.sql の `strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`）と
 * 文字列比較で揃えるため、ミリ秒を切り落とす形式を採用している。
 */
export function nowIsoSeconds(): string {
	return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * IP アドレス形式バリデーション（IP ban 用 #77）。
 * - IPv4: 4 オクテット、各 0-255
 * - IPv6: `:` を含み、全長 2..45、許容文字 [0-9a-fA-F:.]
 * - 上限長 45 文字（IPv6 最大表記）
 * 厳密な IPv6 構文チェックまではせず、bind 引数として安全か（長すぎ・不正文字混入を防ぐ）の
 * レベルで判定する。
 */
export function isValidIpAddress(ip: string): boolean {
	if (typeof ip !== 'string') return false;
	if (ip.length === 0 || ip.length > 45) return false;

	// IPv4
	const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
	if (ipv4) {
		for (let i = 1; i <= 4; i++) {
			const n = Number(ipv4[i]);
			if (!Number.isInteger(n) || n < 0 || n > 255) return false;
		}
		return true;
	}

	// IPv6 簡易: `:` を含み、許容文字のみ
	if (ip.includes(':') && /^[0-9a-fA-F:.]+$/.test(ip)) {
		return true;
	}

	return false;
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
