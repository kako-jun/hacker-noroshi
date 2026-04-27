import { describe, it, expect } from 'vitest';
import { calculateScore, timeAgo, extractDomain, isNewUser, isThreadOpen } from '../../src/lib/ranking';

describe('calculateScore', () => {
	it('newer stories with same points score higher', () => {
		const now = new Date();
		const recent = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString();
		const old = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
		expect(calculateScore(10, recent)).toBeGreaterThan(calculateScore(10, old));
	});

	it('higher points score higher at same age', () => {
		const at = new Date(Date.now() - 60 * 60 * 1000).toISOString();
		expect(calculateScore(50, at)).toBeGreaterThan(calculateScore(5, at));
	});

	it('flag count reduces score', () => {
		const at = new Date(Date.now() - 60 * 60 * 1000).toISOString();
		expect(calculateScore(10, at, 0)).toBeGreaterThan(calculateScore(10, at, 3));
	});

	it('returns a finite number', () => {
		const at = new Date().toISOString();
		expect(Number.isFinite(calculateScore(1, at))).toBe(true);
	});
});

describe('timeAgo', () => {
	const now = Date.now();

	it('returns seconds for under a minute', () => {
		const at = new Date(now - 30 * 1000).toISOString();
		expect(timeAgo(at)).toMatch(/seconds ago$/);
	});

	it('uses singular minute', () => {
		const at = new Date(now - 60 * 1000).toISOString();
		expect(timeAgo(at)).toBe('1 minute ago');
	});

	it('uses plural minutes', () => {
		const at = new Date(now - 5 * 60 * 1000).toISOString();
		expect(timeAgo(at)).toBe('5 minutes ago');
	});

	it('reports hours', () => {
		const at = new Date(now - 3 * 60 * 60 * 1000).toISOString();
		expect(timeAgo(at)).toBe('3 hours ago');
	});

	it('reports days', () => {
		const at = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();
		expect(timeAgo(at)).toBe('5 days ago');
	});

	it('reports years', () => {
		const at = new Date(now - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
		expect(timeAgo(at)).toMatch(/years? ago$/);
	});
});

describe('extractDomain', () => {
	it('returns hostname without www.', () => {
		expect(extractDomain('https://www.example.com/path')).toBe('example.com');
	});

	it('returns empty string for null', () => {
		expect(extractDomain(null)).toBe('');
	});

	it('returns empty string for invalid URL', () => {
		expect(extractDomain('not a url')).toBe('');
	});
});

describe('isNewUser / isThreadOpen', () => {
	it('marks recently created users as new', () => {
		expect(isNewUser(new Date().toISOString())).toBe(true);
	});

	it('does not mark old users as new', () => {
		const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
		expect(isNewUser(old)).toBe(false);
	});

	it('thread is open within 2 weeks', () => {
		expect(isThreadOpen(new Date().toISOString())).toBe(true);
	});

	it('thread is closed after 2 weeks', () => {
		const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
		expect(isThreadOpen(old)).toBe(false);
	});
});
