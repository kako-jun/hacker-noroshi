/**
 * #91: IP ban のセルフサービス unban（Cloudflare Turnstile）。
 *
 * 検証範囲:
 *   - removeActiveBansByIp ヘルパ（active のみ削除、過去 expires_at の行は対象外）
 *   - /ipban?/unban action の挙動:
 *       - cookie で 24h / 3 回までソフト制限（429）
 *       - 該当 IP が ban されていなければ 400
 *       - token 未送信 → 400
 *       - シークレット未設定 → 500
 *       - Turnstile siteverify success:false → 400 + cookie +1
 *       - Turnstile siteverify success:true → 当該 IP の active 全削除 + cookie 削除 + 303
 *
 * Turnstile は globalThis.fetch を一時 mock する（vi.spyOn）ことで検証する。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { actions } from '../../src/routes/ipban/+page.server';
import { callAction } from './helpers/action-helpers';

type AnyAction = (event: RequestEvent) => Promise<unknown> | unknown;
const unban = actions.unban as unknown as AnyAction;

interface IpBanRecord {
	id: number;
	ip: string;
	reason: string;
	banned_at: string;
	expires_at: string | null;
	banned_by: number | null;
}

// ip_bans のみ扱う最小 mock。ip-ban.test.ts の makeMockDB と同じ形だが、
// このテスト固有の形（caller が IP ban 行を直接 inspect する）に合わせて軽量化。
function makeIpBanDB(initial: IpBanRecord[] = []) {
	const bans: IpBanRecord[] = [...initial];
	let nextId = bans.reduce((m, b) => Math.max(m, b.id), 0) + 1;

	function exec(sql: string, params: unknown[]): { all: unknown[]; first: unknown } {
		const s = sql.replace(/\s+/g, ' ').trim();

		// getActiveBan
		if (
			/^SELECT \* FROM ip_bans WHERE ip = \? AND \(expires_at IS NULL OR expires_at > \?\) ORDER BY banned_at DESC LIMIT 1$/i.test(
				s
			)
		) {
			const ip = params[0] as string;
			const now = params[1] as string;
			const matches = bans
				.filter((b) => b.ip === ip && (b.expires_at === null || b.expires_at > now))
				.sort((a, b) => (a.banned_at < b.banned_at ? 1 : -1));
			const first = matches[0] ?? null;
			return { all: first ? [first] : [], first };
		}

		// removeActiveBansByIp / createIpBan の事前 DELETE
		if (
			/^DELETE FROM ip_bans WHERE ip = \? AND \(expires_at IS NULL OR expires_at > \?\)$/i.test(
				s
			)
		) {
			const ip = params[0] as string;
			const now = params[1] as string;
			for (let i = bans.length - 1; i >= 0; i--) {
				const b = bans[i];
				if (b.ip === ip && (b.expires_at === null || b.expires_at > now)) {
					bans.splice(i, 1);
				}
			}
			return { all: [], first: null };
		}

		// createIpBan の INSERT（テスト用に活用）
		if (
			/^INSERT INTO ip_bans \(ip, reason, expires_at, banned_by\) VALUES \(\?, \?, \?, \?\)$/i.test(
				s
			)
		) {
			bans.push({
				id: nextId++,
				ip: params[0] as string,
				reason: params[1] as string,
				banned_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
				expires_at: (params[2] as string | null) ?? null,
				banned_by: (params[3] as number | null) ?? null
			});
			return { all: [], first: null };
		}

		throw new Error(`Unhandled SQL in mock: ${s}`);
	}

	type Stmt = {
		bind: (...params: unknown[]) => Stmt;
		first: <T>() => Promise<T | null>;
		all: <T>() => Promise<{ results: T[] }>;
		run: () => Promise<void>;
	};

	function prepare(sql: string): Stmt {
		let bound: unknown[] = [];
		const stmt: Stmt = {
			bind(...p: unknown[]) {
				bound = p;
				return stmt;
			},
			async first<T>() {
				return exec(sql, bound).first as T | null;
			},
			async all<T>() {
				return { results: exec(sql, bound).all as T[] };
			},
			async run() {
				exec(sql, bound);
			}
		};
		return stmt;
	}

	async function batch(stmts: Stmt[]): Promise<void> {
		for (const s of stmts) await s.run();
	}

	return { db: { prepare, batch } as unknown as D1Database, bans };
}

const FUTURE = '2099-01-01T00:00:00Z';
const PAST = '2000-01-01T00:00:00Z';

function platformWith(db: D1Database, opts: { siteKey?: string | null; secret?: string | null } = {}) {
	const env: Record<string, unknown> = { DB: db };
	if (opts.siteKey !== undefined && opts.siteKey !== null) env.TURNSTILE_SITE_KEY = opts.siteKey;
	if (opts.secret !== undefined && opts.secret !== null) env.TURNSTILE_SECRET_KEY = opts.secret;
	return { env } as { env: { DB: D1Database } };
}

// fetch を mock する共通ヘルパ。Turnstile の siteverify レスポンスを差し替える。
function mockTurnstile(success: boolean) {
	const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
		return new Response(JSON.stringify({ success }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	});
	return fetchSpy;
}

describe('removeActiveBansByIp', () => {
	it('該当 IP の active な ban を全て削除する', async () => {
		const { removeActiveBansByIp } = await import('../../src/lib/server/db');
		const { db, bans } = makeIpBanDB([
			{
				id: 1,
				ip: '1.2.3.4',
				reason: 'a',
				banned_at: '2026-01-01T00:00:00Z',
				expires_at: null,
				banned_by: 1
			},
			{
				id: 2,
				ip: '1.2.3.4',
				reason: 'b',
				banned_at: '2026-01-02T00:00:00Z',
				expires_at: FUTURE,
				banned_by: 1
			}
		]);
		await removeActiveBansByIp(db, '1.2.3.4');
		expect(bans.filter((b) => b.ip === '1.2.3.4').length).toBe(0);
	});

	it('過去 expires_at の行（既に失効）は削除対象外', async () => {
		const { removeActiveBansByIp } = await import('../../src/lib/server/db');
		const { db, bans } = makeIpBanDB([
			{
				id: 1,
				ip: '1.2.3.4',
				reason: 'expired',
				banned_at: '2020-01-01T00:00:00Z',
				expires_at: PAST,
				banned_by: 1
			}
		]);
		await removeActiveBansByIp(db, '1.2.3.4');
		expect(bans.length).toBe(1);
	});

	it('別 IP の ban には触らない', async () => {
		const { removeActiveBansByIp } = await import('../../src/lib/server/db');
		const { db, bans } = makeIpBanDB([
			{
				id: 1,
				ip: '1.2.3.4',
				reason: 'a',
				banned_at: '2026-01-01T00:00:00Z',
				expires_at: null,
				banned_by: 1
			},
			{
				id: 2,
				ip: '5.6.7.8',
				reason: 'b',
				banned_at: '2026-01-01T00:00:00Z',
				expires_at: null,
				banned_by: 1
			}
		]);
		await removeActiveBansByIp(db, '1.2.3.4');
		expect(bans.length).toBe(1);
		expect(bans[0].ip).toBe('5.6.7.8');
	});
});

describe('/ipban?/unban action', () => {
	let fetchSpy: ReturnType<typeof vi.spyOn> | null = null;

	beforeEach(() => {
		fetchSpy = null;
	});

	afterEach(() => {
		fetchSpy?.mockRestore();
		vi.restoreAllMocks();
	});

	it('cookie が 3 回到達済みなら 429 を返し、ban は削除しない', async () => {
		const { db, bans } = makeIpBanDB([
			{
				id: 1,
				ip: '1.2.3.4',
				reason: 'spam',
				banned_at: '2026-01-01T00:00:00Z',
				expires_at: null,
				banned_by: 1
			}
		]);
		const r = await callAction(unban, {
			user: null,
			platform: platformWith(db, { siteKey: 'site', secret: 'secret' }),
			cookies: { unban_attempts: '3' },
			getClientAddress: () => '1.2.3.4',
			formData: { 'cf-turnstile-response': 'tok' }
		});
		expect(r.status).toBe(429);
		expect(bans.length).toBe(1);
	});

	it('該当 IP が ban 中でなければ 400', async () => {
		const { db } = makeIpBanDB([]);
		const r = await callAction(unban, {
			user: null,
			platform: platformWith(db, { siteKey: 'site', secret: 'secret' }),
			getClientAddress: () => '1.2.3.4',
			formData: { 'cf-turnstile-response': 'tok' }
		});
		expect(r.status).toBe(400);
	});

	it('token 未送信なら 400', async () => {
		const { db } = makeIpBanDB([
			{
				id: 1,
				ip: '1.2.3.4',
				reason: 'spam',
				banned_at: '2026-01-01T00:00:00Z',
				expires_at: null,
				banned_by: 1
			}
		]);
		const r = await callAction(unban, {
			user: null,
			platform: platformWith(db, { siteKey: 'site', secret: 'secret' }),
			getClientAddress: () => '1.2.3.4',
			formData: {}
		});
		expect(r.status).toBe(400);
	});

	it('シークレット未設定なら 500', async () => {
		const { db } = makeIpBanDB([
			{
				id: 1,
				ip: '1.2.3.4',
				reason: 'spam',
				banned_at: '2026-01-01T00:00:00Z',
				expires_at: null,
				banned_by: 1
			}
		]);
		const r = await callAction(unban, {
			user: null,
			platform: platformWith(db, { siteKey: 'site' }), // secret 無し
			getClientAddress: () => '1.2.3.4',
			formData: { 'cf-turnstile-response': 'tok' }
		});
		expect(r.status).toBe(500);
	});

	it('Turnstile siteverify が success:false なら 400 を返す', async () => {
		fetchSpy = mockTurnstile(false);
		const { db, bans } = makeIpBanDB([
			{
				id: 1,
				ip: '1.2.3.4',
				reason: 'spam',
				banned_at: '2026-01-01T00:00:00Z',
				expires_at: null,
				banned_by: 1
			}
		]);
		const r = await callAction(unban, {
			user: null,
			platform: platformWith(db, { siteKey: 'site', secret: 'secret' }),
			getClientAddress: () => '1.2.3.4',
			formData: { 'cf-turnstile-response': 'bad-token' }
		});
		expect(r.status).toBe(400);
		// ban は削除されていない
		expect(bans.length).toBe(1);
		// fetch が呼ばれたことを確認
		expect(fetchSpy).toHaveBeenCalled();
	});

	it('Turnstile siteverify が success:true なら active な ban を全削除し /へ 303', async () => {
		fetchSpy = mockTurnstile(true);
		const { db, bans } = makeIpBanDB([
			{
				id: 1,
				ip: '1.2.3.4',
				reason: 'spam',
				banned_at: '2026-01-01T00:00:00Z',
				expires_at: null,
				banned_by: 1
			}
		]);
		const r = await callAction(unban, {
			user: null,
			platform: platformWith(db, { siteKey: 'site', secret: 'secret' }),
			getClientAddress: () => '1.2.3.4',
			formData: { 'cf-turnstile-response': 'good-token' }
		});
		expect(r.status).toBe(303);
		expect(r.redirect).toBe('/');
		expect(bans.filter((b) => b.ip === '1.2.3.4').length).toBe(0);
	});

	it('siteverify が成功すると同 IP の複数 active ban も全部消える', async () => {
		fetchSpy = mockTurnstile(true);
		const { db, bans } = makeIpBanDB([
			{
				id: 1,
				ip: '1.2.3.4',
				reason: 'a',
				banned_at: '2026-01-01T00:00:00Z',
				expires_at: null,
				banned_by: 1
			},
			{
				id: 2,
				ip: '1.2.3.4',
				reason: 'b',
				banned_at: '2026-01-02T00:00:00Z',
				expires_at: FUTURE,
				banned_by: 1
			}
		]);
		const r = await callAction(unban, {
			user: null,
			platform: platformWith(db, { siteKey: 'site', secret: 'secret' }),
			getClientAddress: () => '1.2.3.4',
			formData: { 'cf-turnstile-response': 'good-token' }
		});
		expect(r.status).toBe(303);
		expect(bans.filter((b) => b.ip === '1.2.3.4').length).toBe(0);
	});

	it('CF-Connecting-IP ヘッダがあれば getClientAddress より優先する', async () => {
		fetchSpy = mockTurnstile(true);
		const { db, bans } = makeIpBanDB([
			{
				id: 1,
				ip: '203.0.113.1',
				reason: 'spam',
				banned_at: '2026-01-01T00:00:00Z',
				expires_at: null,
				banned_by: 1
			}
		]);
		const r = await callAction(unban, {
			user: null,
			platform: platformWith(db, { siteKey: 'site', secret: 'secret' }),
			getClientAddress: () => '127.0.0.1', // 直結時の値
			request: { headers: { 'CF-Connecting-IP': '203.0.113.1' } },
			formData: { 'cf-turnstile-response': 'good-token' }
		});
		expect(r.status).toBe(303);
		expect(bans.length).toBe(0);
	});
});
