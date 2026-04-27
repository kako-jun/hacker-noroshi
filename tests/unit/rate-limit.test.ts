/**
 * Rate-limit threshold tests.
 *
 * The current rate-limit logic lives inline in route handlers
 * (e.g. src/routes/submit/+page.server.ts) as:
 *   if (elapsed < 10 * 60 * 1000) { fail(429, ...) }
 *
 * These tests pin the threshold math so a future refactor that
 * extracts this into a shared helper has a clear contract to match.
 * See docs/testing.md "Refactor candidates" for follow-up.
 */
import { describe, it, expect } from 'vitest';

const SUBMIT_COOLDOWN_MS = 10 * 60 * 1000;

function isRateLimited(lastActionAt: number, now: number, cooldownMs: number): boolean {
	return now - lastActionAt < cooldownMs;
}

describe('rate-limit threshold', () => {
	it('blocks within the cooldown window', () => {
		const now = Date.now();
		expect(isRateLimited(now - 1000, now, SUBMIT_COOLDOWN_MS)).toBe(true);
	});

	it('allows after the cooldown window', () => {
		const now = Date.now();
		expect(isRateLimited(now - SUBMIT_COOLDOWN_MS - 1, now, SUBMIT_COOLDOWN_MS)).toBe(false);
	});

	it('blocks exactly at the boundary minus 1ms', () => {
		const now = Date.now();
		expect(isRateLimited(now - SUBMIT_COOLDOWN_MS + 1, now, SUBMIT_COOLDOWN_MS)).toBe(true);
	});

	it('does not block at exactly the cooldown boundary', () => {
		const now = Date.now();
		expect(isRateLimited(now - SUBMIT_COOLDOWN_MS, now, SUBMIT_COOLDOWN_MS)).toBe(false);
	});
});
