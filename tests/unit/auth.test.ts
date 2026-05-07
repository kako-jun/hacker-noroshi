import { describe, it, expect, beforeAll } from 'vitest';
import { webcrypto } from 'node:crypto';

// Polyfill Web Crypto for the auth module which uses the global `crypto` API.
beforeAll(() => {
	if (!(globalThis as unknown as { crypto?: Crypto }).crypto) {
		(globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as unknown as Crypto;
	}
});

describe('hashPassword / verifyPassword', () => {
	it('verifies a correct password', async () => {
		const { hashPassword, verifyPassword } = await import('../../src/lib/server/auth');
		const hash = await hashPassword('correct horse battery staple');
		expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
	});

	it('rejects an incorrect password', async () => {
		const { hashPassword, verifyPassword } = await import('../../src/lib/server/auth');
		const hash = await hashPassword('hunter2');
		expect(await verifyPassword('wrong', hash)).toBe(false);
	});

	it('produces a salt:hash format', async () => {
		const { hashPassword } = await import('../../src/lib/server/auth');
		const hash = await hashPassword('abcd1234');
		expect(hash.split(':')).toHaveLength(2);
	});

	it('two hashes of the same password differ (random salt)', async () => {
		const { hashPassword } = await import('../../src/lib/server/auth');
		const a = await hashPassword('same');
		const b = await hashPassword('same');
		expect(a).not.toBe(b);
	});

	it('returns false for malformed hash', async () => {
		const { verifyPassword } = await import('../../src/lib/server/auth');
		expect(await verifyPassword('any', 'no-colon-here')).toBe(false);
	});

	// #125: db/seed.sql の固定 hash が "test1234" を verify できることを確認する。
	// 実装側 (auth.ts) を変えると seed が壊れるリグレッション検出。
	it('verifies seed.sql password_hash for "test1234"', async () => {
		const { verifyPassword } = await import('../../src/lib/server/auth');
		const seedHash =
			'ddac7a274f5441e1aec447627cccb77e:a7979be7b679ea8949bcf2d340270c78d45ca18e5184da73ff30c3b1d0d89adf';
		expect(await verifyPassword('test1234', seedHash)).toBe(true);
		expect(await verifyPassword('wrong', seedHash)).toBe(false);
	});
});
