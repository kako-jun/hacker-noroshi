/**
 * Unit tests for the signup action (#179 バッチB).
 *
 * users / username_history / sessions の3テーブルだけを扱う専用の in-memory mock を
 * 用意し、src/routes/login/+page.server.ts の actions.signup を直接呼び出して検証する
 * （tests/unit/username-change.test.ts の makeMockDB を参考に、必要最小限の SQL だけに
 * 絞って新規作成した）。
 *
 * username のフォーマット規則自体（3-15文字・英数字+_-）は
 * tests/unit/username-change.test.ts の validateUsernameFormat 側で網羅済みなので、
 * ここでは action への配線（エラーメッセージが signupError として正しく返るか、
 * 成功時に INSERT / createSession / redirect が正しく行われるか）を確認する。
 */
import { describe, it, expect } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { actions } from '../../src/routes/login/+page.server';
import { callAction } from './helpers/action-helpers';

type AnyAction = (event: RequestEvent) => Promise<unknown> | unknown;
const signup = actions.signup as unknown as AnyAction;

interface UserRecord {
	id: number;
	username: string;
	password_hash: string;
}
interface HistoryRecord {
	id: number;
	user_id: number;
	old_username: string;
	new_username: string;
	changed_at: string;
}
interface SessionRecord {
	id: string;
	user_id: number;
	expires_at: string;
}

function makeMockDB(initial?: { users?: UserRecord[]; history?: HistoryRecord[] }) {
	const users: UserRecord[] = [...(initial?.users ?? [])];
	const history: HistoryRecord[] = [...(initial?.history ?? [])];
	const sessions: SessionRecord[] = [];
	let nextUserId = users.reduce((m, u) => Math.max(m, u.id), 0) + 1;

	function exec(
		sql: string,
		params: unknown[]
	): { all: unknown[]; first: unknown; meta?: { last_row_id: number } } {
		const s = sql.replace(/\s+/g, ' ').trim();

		// isUsernameTaken の UNION ALL 版（users 現行名 + username_history 旧名を1クエリで判定）
		if (
			/^SELECT 1 AS hit FROM users WHERE username = \? UNION ALL SELECT 1 AS hit FROM username_history WHERE old_username = \? LIMIT 1$/i.test(
				s
			)
		) {
			const inUsers = users.some((u) => u.username === params[0]);
			const inHistory = history.some((h) => h.old_username === params[1]);
			const hit = inUsers || inHistory;
			return { all: hit ? [{ hit: 1 }] : [], first: hit ? { hit: 1 } : null };
		}

		// signup: INSERT INTO users (username, password_hash) VALUES (?, ?)
		if (/^INSERT INTO users \(username, password_hash\) VALUES \(\?, \?\)$/i.test(s)) {
			const [username, passwordHash] = params as [string, string];
			const id = nextUserId++;
			users.push({ id, username, password_hash: passwordHash });
			return { all: [], first: null, meta: { last_row_id: id } };
		}

		// createSession: INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)
		if (/^INSERT INTO sessions \(id, user_id, expires_at\) VALUES \(\?, \?, \?\)$/i.test(s)) {
			const [id, userId, expiresAt] = params as [string, number, string];
			sessions.push({ id, user_id: userId, expires_at: expiresAt });
			return { all: [], first: null };
		}

		throw new Error(`Unhandled SQL in mock: ${s}`);
	}

	type Stmt = {
		bind: (...params: unknown[]) => Stmt;
		first: <T>() => Promise<T | null>;
		all: <T>() => Promise<{ results: T[] }>;
		run: () => Promise<{ meta: { last_row_id: number } }>;
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
				const r = exec(sql, bound);
				return { meta: r.meta ?? { last_row_id: 0 } };
			}
		};
		return stmt;
	}

	async function batch(stmts: Stmt[]): Promise<void> {
		for (const s of stmts) await s.run();
	}

	return {
		db: { prepare, batch } as unknown as D1Database,
		users,
		history,
		sessions
	};
}

function platformOf(db: D1Database): { env: { DB: D1Database } } {
	return { env: { DB: db } };
}

describe('signup action', () => {
	it('username/password が空なら fail(400, "Username and password are required")', async () => {
		const { db } = makeMockDB();
		const r = await callAction(signup, {
			platform: platformOf(db),
			formData: { username: '', password: '' }
		});
		expect(r.status).toBe(400);
		expect((r.body as { signupError: string }).signupError).toBe(
			'Username and password are required'
		);
	});

	it('フォーマットエラーは signupError として action 経由で返る（代表1ケース: 短すぎる username）', async () => {
		const { db } = makeMockDB();
		const r = await callAction(signup, {
			platform: platformOf(db),
			formData: { username: 'ab', password: 'longenough1' }
		});
		expect(r.status).toBe(400);
		expect((r.body as { signupError: string }).signupError).toMatch(/between 3 and 15/);
	});

	it('パスワードが7文字なら fail(400, "Password must be at least 8 characters")', async () => {
		const { db } = makeMockDB();
		const r = await callAction(signup, {
			platform: platformOf(db),
			formData: { username: 'validuser1', password: '1234567' }
		});
		expect(r.status).toBe(400);
		expect((r.body as { signupError: string }).signupError).toBe(
			'Password must be at least 8 characters'
		);
	});

	it('パスワードが8文字ちょうどなら成功する（境界）', async () => {
		const { db } = makeMockDB();
		const r = await callAction(signup, {
			platform: platformOf(db),
			formData: { username: 'validuser2', password: '12345678' }
		});
		expect(r.status).toBe(302);
	});

	it('パスワードが9文字なら成功する', async () => {
		const { db } = makeMockDB();
		const r = await callAction(signup, {
			platform: platformOf(db),
			formData: { username: 'validuser3', password: '123456789' }
		});
		expect(r.status).toBe(302);
	});

	it('既存 users に同名があれば fail(400, "That username is taken")', async () => {
		const { db } = makeMockDB({ users: [{ id: 1, username: 'taken1', password_hash: 'x' }] });
		const r = await callAction(signup, {
			platform: platformOf(db),
			formData: { username: 'taken1', password: 'longenough1' }
		});
		expect(r.status).toBe(400);
		expect((r.body as { signupError: string }).signupError).toBe('That username is taken');
	});

	it('username_history に同名があれば（過去に使われて改名済み）fail(400, "That username is taken")', async () => {
		const { db } = makeMockDB({
			users: [{ id: 1, username: 'newname', password_hash: 'x' }],
			history: [
				{
					id: 1,
					user_id: 1,
					old_username: 'oldname',
					new_username: 'newname',
					changed_at: '2026-01-01T00:00:00Z'
				}
			]
		});
		const r = await callAction(signup, {
			platform: platformOf(db),
			formData: { username: 'oldname', password: 'longenough1' }
		});
		expect(r.status).toBe(400);
		expect((r.body as { signupError: string }).signupError).toBe('That username is taken');
	});

	it('正常系: users に INSERT され、session が作られ、next（safeNext正規化後）へ redirect する', async () => {
		const { db, users, sessions } = makeMockDB();
		const r = await callAction(signup, {
			platform: platformOf(db),
			// オープンリダイレクト値をわざと渡し、action が safeNext を通してから
			// redirect していることを確認する（生の next をそのまま使っていないこと）。
			formData: { username: 'freshuser', password: 'longenough1', next: '//evil.com' }
		});
		expect(r.status).toBe(302);
		expect(r.redirect).toBe('/');
		const created = users.find((u) => u.username === 'freshuser');
		expect(created).toBeTruthy();
		expect(sessions).toHaveLength(1);
		expect(sessions[0].user_id).toBe(created!.id);
	});
});
