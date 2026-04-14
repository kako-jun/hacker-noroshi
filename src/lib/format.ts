/**
 * HN-compatible text formatting.
 * - HTML escape (XSS prevention)
 * - Auto-link URLs
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

function autoLinkUrls(text: string): string {
	return text.replace(
		/https?:\/\/[^\s&lt;&gt;]*/g,
		(url) => `<a href="${url}" rel="nofollow noreferrer">${url}</a>`
	);
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

export function formatText(text: string): string {
	let result = escapeHtml(text);
	result = autoLinkUrls(result);
	result = italicize(result);
	return result;
}
