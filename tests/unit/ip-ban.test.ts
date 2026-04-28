/**
 * Unit tests for IP ban (#77).
 *
 * 骨格のみ。CAPTCHA セルフ unban (#91) と自動 ban (#92) は別 Issue。
 *
 * 検証範囲:
 *   - getActiveBan: ヒット / 期限切れ / 該当なし
 *   - createIpBan / removeIpBan の基本フロー
 *   - expires_at が NULL（無期限）の active 判定
 *   - 過去日時の expires_at は active ではない
 */
import { describe, it, expect } from 'vitest';

interface IpBanRecord {
	id: number;
	ip: string;
	reason: string;
	banned_at: string;
	expires_at: string | null;
	banned_by: number | null;
}

function makeMockDB(initial: IpBanRecord[] = []) {
	const bans: IpBanRecord[] = [...initial];
	let nextId = bans.reduce((m, b) => Math.max(m, b.id), 0) + 1;

	function exec(sql: string, params: unknown[]): { all: unknown[]; first: unknown } {
		const s = sql.replace(/\s+/g, ' ').trim();

		// getActiveBan: SELECT * FROM ip_bans WHERE ip = ? AND (expires_at IS NULL OR expires_at > ?) ORDER BY banned_at DESC LIMIT 1
		if (
			/^SELECT \* FROM ip_bans WHERE ip = \? AND \(expires_at IS NULL OR expires_at > \?\) ORDER BY banned_at DESC LIMIT 1$/i.test(
				s
			)
		) {
			const ip = params[0] as string;
			const now = params[1] as string;
			const matches = bans
				.filter(
					(b) => b.ip === ip && (b.expires_at === null || b.expires_at > now)
				)
				.sort((a, b) => (a.banned_at < b.banned_at ? 1 : -1));
			const first = matches[0] ?? null;
			return { all: first ? [first] : [], first };
		}

		// listActiveBans
		if (
			/^SELECT \* FROM ip_bans WHERE expires_at IS NULL OR expires_at > \? ORDER BY banned_at DESC$/i.test(
				s
			)
		) {
			const now = params[0] as string;
			const matches = bans
				.filter((b) => b.expires_at === null || b.expires_at > now)
				.sort((a, b) => (a.banned_at < b.banned_at ? 1 : -1));
			return { all: matches, first: matches[0] ?? null };
		}

		// createIpBan
		if (
			/^INSERT INTO ip_bans \(ip, reason, expires_at, banned_by\) VALUES \(\?, \?, \?, \?\)$/i.test(s)
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

		// removeIpBan
		if (/^DELETE FROM ip_bans WHERE id = \?$/i.test(s)) {
			const id = params[0] as number;
			const idx = bans.findIndex((b) => b.id === id);
			if (idx >= 0) bans.splice(idx, 1);
			return { all: [], first: null };
		}

		// expireIpBan
		if (/^UPDATE ip_bans SET expires_at = \? WHERE id = \?$/i.test(s)) {
			const expiresAt = params[0] as string;
			const id = params[1] as number;
			const b = bans.find((x) => x.id === id);
			if (b) b.expires_at = expiresAt;
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

describe('getActiveBan', () => {
	it('該当 IP に無期限 ban があればヒットする', async () => {
		const { getActiveBan } = await import('../../src/lib/server/db');
		const { db } = makeMockDB([
			{
				id: 1,
				ip: '1.2.3.4',
				reason: 'spam',
				banned_at: '2026-01-01T00:00:00Z',
				expires_at: null,
				banned_by: 1
			}
		]);
		const ban = await getActiveBan(db, '1.2.3.4');
		expect(ban).not.toBeNull();
		expect(ban?.ip).toBe('1.2.3.4');
		expect(ban?.expires_at).toBeNull();
	});

	it('未来の expires_at を持つ ban はヒットする', async () => {
		const { getActiveBan } = await import('../../src/lib/server/db');
		const { db } = makeMockDB([
			{
				id: 1,
				ip: '1.2.3.4',
				reason: 'spam',
				banned_at: '2026-01-01T00:00:00Z',
				expires_at: FUTURE,
				banned_by: 1
			}
		]);
		const ban = await getActiveBan(db, '1.2.3.4');
		expect(ban).not.toBeNull();
		expect(ban?.expires_at).toBe(FUTURE);
	});

	it('過去の expires_at を持つ ban は active ではない', async () => {
		const { getActiveBan } = await import('../../src/lib/server/db');
		const { db } = makeMockDB([
			{
				id: 1,
				ip: '1.2.3.4',
				reason: 'spam',
				banned_at: '2020-01-01T00:00:00Z',
				expires_at: PAST,
				banned_by: 1
			}
		]);
		const ban = await getActiveBan(db, '1.2.3.4');
		expect(ban).toBeNull();
	});

	it('該当 IP の ban が無ければ null', async () => {
		const { getActiveBan } = await import('../../src/lib/server/db');
		const { db } = makeMockDB([]);
		const ban = await getActiveBan(db, '9.9.9.9');
		expect(ban).toBeNull();
	});

	it('別 IP の ban は混入しない', async () => {
		const { getActiveBan } = await import('../../src/lib/server/db');
		const { db } = makeMockDB([
			{
				id: 1,
				ip: '1.2.3.4',
				reason: 'spam',
				banned_at: '2026-01-01T00:00:00Z',
				expires_at: null,
				banned_by: 1
			}
		]);
		const ban = await getActiveBan(db, '5.6.7.8');
		expect(ban).toBeNull();
	});
});

describe('createIpBan / removeIpBan', () => {
	it('createIpBan で行が追加され、getActiveBan で引ける', async () => {
		const { createIpBan, getActiveBan } = await import('../../src/lib/server/db');
		const { db, bans } = makeMockDB([]);
		await createIpBan(db, {
			ip: '1.2.3.4',
			reason: 'test',
			expiresAt: FUTURE,
			bannedBy: 1
		});
		expect(bans.length).toBe(1);
		const ban = await getActiveBan(db, '1.2.3.4');
		expect(ban?.reason).toBe('test');
	});

	it('expiresAt = null で無期限 ban を作成できる', async () => {
		const { createIpBan, getActiveBan } = await import('../../src/lib/server/db');
		const { db } = makeMockDB([]);
		await createIpBan(db, {
			ip: '1.2.3.4',
			reason: 'permanent',
			expiresAt: null,
			bannedBy: 1
		});
		const ban = await getActiveBan(db, '1.2.3.4');
		expect(ban?.expires_at).toBeNull();
	});

	it('removeIpBan で ban が消え、getActiveBan が null を返す', async () => {
		const { createIpBan, removeIpBan, getActiveBan } = await import(
			'../../src/lib/server/db'
		);
		const { db, bans } = makeMockDB([]);
		await createIpBan(db, {
			ip: '1.2.3.4',
			reason: 'spam',
			expiresAt: null,
			bannedBy: 1
		});
		const id = bans[0].id;
		await removeIpBan(db, id);
		expect(bans.length).toBe(0);
		const ban = await getActiveBan(db, '1.2.3.4');
		expect(ban).toBeNull();
	});
});

describe('listActiveBans', () => {
	it('active な ban のみを返す（過去 expires_at は除外）', async () => {
		const { listActiveBans } = await import('../../src/lib/server/db');
		const { db } = makeMockDB([
			{
				id: 1,
				ip: '1.1.1.1',
				reason: 'a',
				banned_at: '2026-01-01T00:00:00Z',
				expires_at: null,
				banned_by: 1
			},
			{
				id: 2,
				ip: '2.2.2.2',
				reason: 'b',
				banned_at: '2026-02-01T00:00:00Z',
				expires_at: PAST,
				banned_by: 1
			},
			{
				id: 3,
				ip: '3.3.3.3',
				reason: 'c',
				banned_at: '2026-03-01T00:00:00Z',
				expires_at: FUTURE,
				banned_by: 1
			}
		]);
		const list = await listActiveBans(db);
		expect(list.length).toBe(2);
		const ips = list.map((b) => b.ip).sort();
		expect(ips).toEqual(['1.1.1.1', '3.3.3.3']);
	});
});
