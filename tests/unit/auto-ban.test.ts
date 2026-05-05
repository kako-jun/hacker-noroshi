/**
 * Unit tests for IP 自動 ban (#92).
 *
 * 検証範囲:
 *   - recordLoginFailure / countRecentLoginFailures / cleanupOldLoginFailures の挙動
 *   - login action 経由で「パスワード不一致 / ユーザー不在 / deleted ユーザー」のいずれでも
 *     失敗ログが残ること
 *   - 5 分間 / 10 失敗 → 1 時間 ban が発動
 *   - 1 時間 / 30 失敗 → 24 時間 ban が発動（より長い側を優先）
 *   - 既に active な ban がある場合は失敗ログ INSERT も新規 ban INSERT も避ける（重複防止 / テーブル肥大化防止）
 *   - 通常の login 成功時 / バリデーションエラー時は失敗ログを残さない
 */
import { describe, it, expect } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { actions } from '../../src/routes/login/+page.server';
import { callAction } from './helpers/action-helpers';
import { hashPassword } from '../../src/lib/server/auth';

type AnyAction = (event: RequestEvent) => Promise<unknown> | unknown;
const login = actions.login as unknown as AnyAction;

interface IpBanRecord {
	id: number;
	ip: string;
	reason: string;
	banned_at: string;
	expires_at: string | null;
	banned_by: number | null;
}

interface LoginFailureRecord {
	id: number;
	ip: string;
	created_at: string;
}

interface UserRecord {
	id: number;
	username: string;
	password_hash: string;
	deleted: number;
	deleted_at: string | null;
	is_admin: number;
	karma: number;
	about: string;
	delay: number;
	noprocrast: number;
	maxvisit: number;
	minaway: number;
	showdead: number;
	last_visit: string | null;
	created_at: string;
}

interface MockState {
	bans: IpBanRecord[];
	failures: LoginFailureRecord[];
	users: UserRecord[];
	sessions: { id: string; user_id: number; expires_at: string }[];
}

function makeMockDB(initial: {
	users?: Partial<UserRecord>[];
	failures?: LoginFailureRecord[];
	bans?: IpBanRecord[];
}): { db: D1Database; state: MockState } {
	const userDefaults: Omit<UserRecord, 'id' | 'username' | 'password_hash'> = {
		deleted: 0,
		deleted_at: null,
		is_admin: 0,
		karma: 0,
		about: '',
		delay: 0,
		noprocrast: 0,
		maxvisit: 20,
		minaway: 180,
		showdead: 0,
		last_visit: null,
		created_at: '2026-01-01T00:00:00Z'
	};

	const users: UserRecord[] = (initial.users ?? []).map(
		(u) =>
			({
				...userDefaults,
				password_hash: 'noset',
				...u
			}) as UserRecord
	);
	const failures: LoginFailureRecord[] = [...(initial.failures ?? [])];
	const bans: IpBanRecord[] = [...(initial.bans ?? [])];
	const sessions: { id: string; user_id: number; expires_at: string }[] = [];

	let nextBanId = bans.reduce((m, b) => Math.max(m, b.id), 0) + 1;
	let nextFailureId = failures.reduce((m, f) => Math.max(m, f.id), 0) + 1;

	function exec(sql: string, params: unknown[]): { all: unknown[]; first: unknown } {
		const s = sql.replace(/\s+/g, ' ').trim();

		// getUserByUsername
		if (/^SELECT \* FROM users WHERE username = \?$/i.test(s)) {
			const username = params[0] as string;
			const u = users.find((x) => x.username === username) ?? null;
			return { all: u ? [u] : [], first: u };
		}

		// recordLoginFailure
		if (
			/^INSERT INTO ip_login_failures \(ip, created_at\) VALUES \(\?, \?\)$/i.test(s)
		) {
			failures.push({
				id: nextFailureId++,
				ip: params[0] as string,
				created_at: params[1] as string
			});
			return { all: [], first: null };
		}

		// countRecentLoginFailures
		if (
			/^SELECT COUNT\(\*\) AS n FROM ip_login_failures WHERE ip = \? AND created_at > \?$/i.test(
				s
			)
		) {
			const ip = params[0] as string;
			const since = params[1] as string;
			const n = failures.filter((f) => f.ip === ip && f.created_at > since).length;
			return { all: [{ n }], first: { n } };
		}

		// cleanupOldLoginFailures
		if (/^DELETE FROM ip_login_failures WHERE created_at < \?$/i.test(s)) {
			const cutoff = params[0] as string;
			for (let i = failures.length - 1; i >= 0; i--) {
				if (failures[i].created_at < cutoff) failures.splice(i, 1);
			}
			return { all: [], first: null };
		}

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

		// createIpBan の事前 DELETE
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

		// createIpBan
		if (
			/^INSERT INTO ip_bans \(ip, reason, expires_at, banned_by\) VALUES \(\?, \?, \?, \?\)$/i.test(
				s
			)
		) {
			bans.push({
				id: nextBanId++,
				ip: params[0] as string,
				reason: params[1] as string,
				banned_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
				expires_at: (params[2] as string | null) ?? null,
				banned_by: (params[3] as number | null) ?? null
			});
			return { all: [], first: null };
		}

		// createSession (login 成功時)
		if (/^INSERT INTO sessions \(id, user_id, expires_at\) VALUES \(\?, \?, \?\)$/i.test(s)) {
			sessions.push({
				id: params[0] as string,
				user_id: params[1] as number,
				expires_at: params[2] as string
			});
			return { all: [], first: null };
		}

		throw new Error(`Unhandled SQL in auto-ban mock: ${s}`);
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

	return {
		db: { prepare, batch } as unknown as D1Database,
		state: { bans, failures, users, sessions }
	};
}

function platformOf(db: D1Database): { env: { DB: D1Database } } {
	return { env: { DB: db } };
}

function makeFailures(ip: string, count: number, ageMinutes: number): LoginFailureRecord[] {
	const list: LoginFailureRecord[] = [];
	for (let i = 0; i < count; i++) {
		const ts = new Date(Date.now() - ageMinutes * 60 * 1000 + i * 1000)
			.toISOString()
			.replace(/\.\d{3}Z$/, 'Z');
		list.push({ id: i + 1, ip, created_at: ts });
	}
	return list;
}

describe('recordLoginFailure / countRecentLoginFailures', () => {
	it('recordLoginFailure で行が追加され、count で引ける', async () => {
		const { recordLoginFailure, countRecentLoginFailures } = await import(
			'../../src/lib/server/db'
		);
		const { db, state } = makeMockDB({});
		await recordLoginFailure(db, '1.2.3.4');
		await recordLoginFailure(db, '1.2.3.4');
		expect(state.failures.length).toBe(2);
		const n = await countRecentLoginFailures(db, '1.2.3.4', 5);
		expect(n).toBe(2);
	});

	it('時間窓の外側の失敗はカウントされない', async () => {
		const { countRecentLoginFailures } = await import('../../src/lib/server/db');
		// 10 分前と 1 分前の失敗を 1 件ずつ
		const { db } = makeMockDB({
			failures: [
				...makeFailures('1.2.3.4', 1, 10),
				...makeFailures('1.2.3.4', 1, 1)
			]
		});
		const fiveMin = await countRecentLoginFailures(db, '1.2.3.4', 5);
		expect(fiveMin).toBe(1);
		const fifteenMin = await countRecentLoginFailures(db, '1.2.3.4', 15);
		expect(fifteenMin).toBe(2);
	});

	it('別 IP の失敗は混入しない', async () => {
		const { countRecentLoginFailures } = await import('../../src/lib/server/db');
		const { db } = makeMockDB({
			failures: [...makeFailures('1.2.3.4', 5, 1), ...makeFailures('5.6.7.8', 3, 1)]
		});
		const a = await countRecentLoginFailures(db, '1.2.3.4', 5);
		const b = await countRecentLoginFailures(db, '5.6.7.8', 5);
		expect(a).toBe(5);
		expect(b).toBe(3);
	});
});

describe('cleanupOldLoginFailures', () => {
	it('24h 超のレコードのみ削除される', async () => {
		const { cleanupOldLoginFailures } = await import('../../src/lib/server/db');
		// 25h 前 / 23h 前 / 1 分前
		const { db, state } = makeMockDB({
			failures: [
				...makeFailures('1.2.3.4', 1, 25 * 60),
				...makeFailures('1.2.3.4', 1, 23 * 60),
				...makeFailures('1.2.3.4', 1, 1)
			]
		});
		await cleanupOldLoginFailures(db);
		expect(state.failures.length).toBe(2);
		// 24h 以内のものだけ残る
		const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
		for (const f of state.failures) {
			expect(f.created_at >= cutoff.replace(/\.\d{3}Z$/, 'Z')).toBe(true);
		}
	});
});

describe('login action: 失敗ログ記録', () => {
	it('ユーザー不在の Bad login で失敗ログが残る', async () => {
		const { db, state } = makeMockDB({});
		const r = await callAction(login, {
			platform: platformOf(db),
			formData: { username: 'nobody', password: 'whatever' },
			getClientAddress: () => '1.2.3.4'
		});
		expect(r.status).toBe(400);
		expect(state.failures.length).toBe(1);
		expect(state.failures[0].ip).toBe('1.2.3.4');
	});

	it('パスワード不一致の Bad login で失敗ログが残る', async () => {
		const passwordHash = await hashPassword('correct');
		const { db, state } = makeMockDB({
			users: [{ id: 1, username: 'alice', password_hash: passwordHash }]
		});
		const r = await callAction(login, {
			platform: platformOf(db),
			formData: { username: 'alice', password: 'wrong' },
			getClientAddress: () => '1.2.3.4'
		});
		expect(r.status).toBe(400);
		expect(state.failures.length).toBe(1);
	});

	it('deleted ユーザーへの login で失敗ログが残る', async () => {
		const passwordHash = await hashPassword('correct');
		const { db, state } = makeMockDB({
			users: [
				{ id: 1, username: 'gone', password_hash: passwordHash, deleted: 1 }
			]
		});
		const r = await callAction(login, {
			platform: platformOf(db),
			formData: { username: 'gone', password: 'correct' },
			getClientAddress: () => '1.2.3.4'
		});
		expect(r.status).toBe(400);
		expect(state.failures.length).toBe(1);
	});

	it('バリデーションエラー（password 空）は失敗ログを残さない', async () => {
		const { db, state } = makeMockDB({});
		const r = await callAction(login, {
			platform: platformOf(db),
			formData: { username: 'alice', password: '' },
			getClientAddress: () => '1.2.3.4'
		});
		expect(r.status).toBe(400);
		expect(state.failures.length).toBe(0);
	});

	it('バリデーションエラー（username 空）は失敗ログを残さない', async () => {
		const { db, state } = makeMockDB({});
		const r = await callAction(login, {
			platform: platformOf(db),
			formData: { username: '', password: 'whatever' },
			getClientAddress: () => '1.2.3.4'
		});
		expect(r.status).toBe(400);
		expect(state.failures.length).toBe(0);
	});

	it('login 成功時は失敗ログを残さず ban も発動しない', async () => {
		const passwordHash = await hashPassword('correct');
		const { db, state } = makeMockDB({
			users: [{ id: 1, username: 'alice', password_hash: passwordHash }]
		});
		const r = await callAction(login, {
			platform: platformOf(db),
			formData: { username: 'alice', password: 'correct' },
			getClientAddress: () => '1.2.3.4'
		});
		expect(r.status).toBe(302);
		expect(state.failures.length).toBe(0);
		expect(state.bans.length).toBe(0);
	});

	it('CF-Connecting-IP ヘッダがあればそれを優先する', async () => {
		const { db, state } = makeMockDB({});
		const r = await callAction(login, {
			platform: platformOf(db),
			formData: { username: 'nobody', password: 'whatever' },
			getClientAddress: () => '127.0.0.1',
			request: { headers: { 'CF-Connecting-IP': '203.0.113.7' } }
		});
		expect(r.status).toBe(400);
		expect(state.failures[0].ip).toBe('203.0.113.7');
	});
});

describe('login action: 自動 ban 発動', () => {
	it('5 分間 / 10 失敗目で 1 時間 ban が発動する', async () => {
		// 既に 9 件の最近失敗を仕込み、10 件目で発動させる
		const { db, state } = makeMockDB({
			failures: makeFailures('1.2.3.4', 9, 1)
		});
		const r = await callAction(login, {
			platform: platformOf(db),
			formData: { username: 'nobody', password: 'whatever' },
			getClientAddress: () => '1.2.3.4'
		});
		expect(r.status).toBe(400);
		expect(state.failures.length).toBe(10);
		expect(state.bans.length).toBe(1);
		expect(state.bans[0].ip).toBe('1.2.3.4');
		expect(state.bans[0].reason).toMatch(/5min\/10/);
		expect(state.bans[0].banned_by).toBeNull();
		// 期限は 1 時間後付近
		const expires = new Date(state.bans[0].expires_at as string).getTime();
		const expectedMin = Date.now() + 55 * 60 * 1000;
		const expectedMax = Date.now() + 65 * 60 * 1000;
		expect(expires).toBeGreaterThan(expectedMin);
		expect(expires).toBeLessThan(expectedMax);
	});

	it('5 分間 / 9 失敗では ban されない', async () => {
		// 8 件 + 今回で計 9 件なので閾値（10）未満
		const { db, state } = makeMockDB({
			failures: makeFailures('1.2.3.4', 8, 1)
		});
		const r = await callAction(login, {
			platform: platformOf(db),
			formData: { username: 'nobody', password: 'whatever' },
			getClientAddress: () => '1.2.3.4'
		});
		expect(r.status).toBe(400);
		expect(state.failures.length).toBe(9);
		expect(state.bans.length).toBe(0);
	});

	it('1 時間 / 30 失敗で 24 時間 ban が発動する（より長い側を優先）', async () => {
		// 5 分窓には収まらないが 1 時間窓には収まる失敗を 29 件 + 今回 1 件 = 30 件
		// 30 分前を中心に分散させて 5min/10 条件は外す
		const failures: LoginFailureRecord[] = [];
		for (let i = 0; i < 29; i++) {
			// 10 〜 50 分前に分散（5min 窓には入らない）
			const ageMin = 10 + (i % 40);
			const ts = new Date(Date.now() - ageMin * 60 * 1000)
				.toISOString()
				.replace(/\.\d{3}Z$/, 'Z');
			failures.push({ id: i + 1, ip: '1.2.3.4', created_at: ts });
		}
		const { db, state } = makeMockDB({ failures });
		const r = await callAction(login, {
			platform: platformOf(db),
			formData: { username: 'nobody', password: 'whatever' },
			getClientAddress: () => '1.2.3.4'
		});
		expect(r.status).toBe(400);
		expect(state.bans.length).toBe(1);
		expect(state.bans[0].reason).toMatch(/60min\/30/);
		// 期限は 24 時間後付近
		const expires = new Date(state.bans[0].expires_at as string).getTime();
		const expectedMin = Date.now() + (24 * 60 - 5) * 60 * 1000;
		const expectedMax = Date.now() + (24 * 60 + 5) * 60 * 1000;
		expect(expires).toBeGreaterThan(expectedMin);
		expect(expires).toBeLessThan(expectedMax);
	});

	it('5min/10 と 60min/30 が同時にマッチしたら 24 時間側を採用する', async () => {
		// 直近 1 分以内に 30 件の失敗（5min/10 も 60min/30 も同時に true）
		const { db, state } = makeMockDB({
			failures: makeFailures('1.2.3.4', 29, 1)
		});
		const r = await callAction(login, {
			platform: platformOf(db),
			formData: { username: 'nobody', password: 'whatever' },
			getClientAddress: () => '1.2.3.4'
		});
		expect(r.status).toBe(400);
		expect(state.bans.length).toBe(1);
		expect(state.bans[0].reason).toMatch(/60min\/30/);
	});

	it('既に active な ban があれば新規 INSERT されない', async () => {
		const future = new Date(Date.now() + 60 * 60 * 1000)
			.toISOString()
			.replace(/\.\d{3}Z$/, 'Z');
		const { db, state } = makeMockDB({
			failures: makeFailures('1.2.3.4', 9, 1),
			bans: [
				{
					id: 1,
					ip: '1.2.3.4',
					reason: 'manual',
					banned_at: '2026-01-01T00:00:00Z',
					expires_at: future,
					banned_by: 1
				}
			]
		});
		const r = await callAction(login, {
			platform: platformOf(db),
			formData: { username: 'nobody', password: 'whatever' },
			getClientAddress: () => '1.2.3.4'
		});
		expect(r.status).toBe(400);
		// active ban 中は失敗ログ自体も記録しない（curl 等で直接 POST する攻撃者に
		// ip_login_failures を膨らまされないため）。事前に仕込んだ 9 件のみ残る。
		expect(state.failures.length).toBe(9);
		// ban は 1 件のまま（既存を上書きしない）
		expect(state.bans.length).toBe(1);
		expect(state.bans[0].reason).toBe('manual');
	});
});
