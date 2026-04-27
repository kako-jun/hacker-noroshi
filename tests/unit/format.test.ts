import { describe, it, expect } from 'vitest';
import { formatText } from '../../src/lib/format';

describe('formatText', () => {
	it('escapes HTML special characters', () => {
		expect(formatText('<script>alert(1)</script>')).toBe(
			'&lt;script&gt;alert(1)&lt;/script&gt;'
		);
	});

	it('auto-links http(s) URLs', () => {
		const out = formatText('see https://example.com for details');
		expect(out).toContain('<a href="https://example.com"');
		expect(out).toContain('rel="nofollow noreferrer"');
	});

	it('strips trailing punctuation from URL', () => {
		const out = formatText('check https://example.com.');
		expect(out).toContain('href="https://example.com"');
		expect(out).toMatch(/&gt;\s*\.|\.$|>\.$/);
	});

	it('converts *italic* to <i>italic</i>', () => {
		expect(formatText('this is *cool* stuff')).toContain('<i>cool</i>');
	});

	it('does not italicize a lone asterisk', () => {
		expect(formatText('just * here')).not.toContain('<i>');
	});

	it('escapes ampersands and quotes', () => {
		expect(formatText('a & "b"')).toBe('a &amp; &quot;b&quot;');
	});
});
