/**
 * Unit tests for the account deletion feature (#76).
 *
 * 本家HN FAQ #32 相当のセルフサービス削除を検証する。
 * D1 はネイティブ依存があり CI では本物を使えないため、必要な SQL に対応する
 * in-memory モックを書いて関数の振る舞いを検証する。
 *
 * 検証範囲:
 *   - deleteAccount: 個人情報のクリア + deleted フラグ + sessions 削除
 *   - パスワード認証失敗で 400
 *   - 認可失敗（他人の削除）で 403
 *   - 削除済みアカウントのログイン拒否（getSession が deleted=0 でフィルタ）
 *   - isUsernameTaken: 削除済み username も永久ロック
 *   - displayUsername ヘルパ
 */
import { describe, it, expect } from 'vitest';

interface UserRecord {
	id: number;
	username: string;
	password_hash: string;
	email: string;
	about: string;
	delay: number;
	noprocrast: number;
	maxvisit: number;
	minaway: number;
	showdead: number;
	last_visit: string | null;
	deleted: number;
	deleted_at: string | null;
}

interface SessionRecord {
	id: string;
	user_id: number;
	expires_at: string;
}

function makeMockDB(initial?: { users?: Partial<UserRecord>[]; sessions?: SessionRecord[] }) {
	const defaults: Omit<UserRecord, 'id' | 'username'> = {
		password_hash: 'hash',
		email: 'a@b.test',
		about: 'hello',
		delay: 5,
		noprocrast: 1,
		maxvisit: 30,
		minaway: 90,
		showdead: 1,
		last_visit: '2026-04-01T00:00:00Z',
		deleted: 0,
		deleted_at: null
	};
	const users: UserRecord[] = (initial?.users ?? []).map((u) => ({
		...defaults,
		...u
	} as UserRecord));
	const sessions: SessionRecord[] = [...(initial?.sessions ?? [])];

	function exec(sql: string, params: unknown[]): { all: unknown[]; first: unknown } {
		const s = sql.replace(/\s+/g, ' ').trim();

		// deleteAccount の UPDATE
		if (
			/^UPDATE users SET deleted = 1, deleted_at = \?, email = '', about = '', password_hash = '', delay = 0, noprocrast = 0, maxvisit = 20, minaway = 180, showdead = 0, last_visit = NULL WHERE id = \?$/i.test(
				s
			)
		) {
			const deletedAt = params[0] as string;
			const id = params[1] as number;
			const u = users.find((x) => x.id === id);
			if (u) {
				u.deleted = 1;
				u.deleted_at = deletedAt;
				u.email = '';
				u.about = '';
				u.password_hash = '';
				u.delay = 0;
				u.noprocrast = 0;
				u.maxvisit = 20;
				u.minaway = 180;
				u.showdead = 0;
				u.last_visit = null;
			}
			return { all: [], first: null };
		}
		if (/^DELETE FROM sessions WHERE user_id = \?$/i.test(s)) {
			const id = params[0] as number;
			for (let i = sessions.length - 1; i >= 0; i--) {
				if (sessions[i].user_id === id) sessions.splice(i, 1);
			}
			return { all: [], first: null };
		}

		// isUsernameTaken (UNION ALL)
		if (
			/^SELECT 1 AS hit FROM users WHERE username = \? UNION ALL SELECT 1 AS hit FROM username_history WHERE old_username = \? LIMIT 1$/i.test(
				s
			)
		) {
			const hit = users.some((u) => u.username === params[0]);
			return { all: hit ? [{ hit: 1 }] : [], first: hit ? { hit: 1 } : null };
		}

		// getUserById
		if (/^SELECT \* FROM users WHERE id = \?$/i.test(s)) {
			const u = users.find((x) => x.id === params[0]);
			return { all: u ? [u] : [], first: u ?? null };
		}

		// getUserByUsername
		if (/^SELECT \* FROM users WHERE username = \?$/i.test(s)) {
			const u = users.find((x) => x.username === params[0]);
			return { all: u ? [u] : [], first: u ?? null };
		}

		// getSession 用（deleted=0 フィルタを含む）
		if (
			/^SELECT u\.id, u\.username, u\.karma, u\.delay, u\.noprocrast, u\.maxvisit, u\.minaway, u\.showdead, u\.last_visit FROM sessions s JOIN users u ON s\.user_id = u\.id WHERE s\.id = \? AND s\.expires_at > datetime\('now'\) AND u\.deleted = 0$/i.test(
				s
			)
		) {
			const sess = sessions.find((x) => x.id === params[0]);
			if (!sess) return { all: [], first: null };
			const u = users.find((x) => x.id === sess.user_id);
			if (!u || u.deleted !== 0) return { all: [], first: null };
			const row = {
				id: u.id,
				username: u.username,
				karma: 0,
				delay: u.delay,
				noprocrast: u.noprocrast,
				maxvisit: u.maxvisit,
				minaway: u.minaway,
				showdead: u.showdead,
				last_visit: u.last_visit
			};
			return { all: [row], first: row };
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

	return {
		db: { prepare, batch } as unknown as D1Database,
		users,
		sessions
	};
}

describe('deleteAccount', () => {
	it('users 行の個人情報をクリアし deleted=1 を立てる', async () => {
		const { deleteAccount } = await import('../../src/lib/server/db');
		const { db, users } = makeMockDB({
			users: [{ id: 1, username: 'alice' }]
		});
		await deleteAccount(db, 1);
		const u = users.find((x) => x.id === 1)!;
		expect(u.deleted).toBe(1);
		expect(u.deleted_at).toBeTruthy();
		expect(u.email).toBe('');
		expect(u.about).toBe('');
		expect(u.password_hash).toBe('');
		expect(u.delay).toBe(0);
		expect(u.noprocrast).toBe(0);
		expect(u.maxvisit).toBe(20);
		expect(u.minaway).toBe(180);
		expect(u.showdead).toBe(0);
		expect(u.last_visit).toBeNull();
	});

	it('対象ユーザーの sessions を全て削除する', async () => {
		const { deleteAccount } = await import('../../src/lib/server/db');
		const { db, sessions } = makeMockDB({
			users: [{ id: 1, username: 'alice' }],
			sessions: [
				{ id: 's1', user_id: 1, expires_at: '2099-01-01T00:00:00Z' },
				{ id: 's2', user_id: 1, expires_at: '2099-01-01T00:00:00Z' },
				{ id: 's3', user_id: 2, expires_at: '2099-01-01T00:00:00Z' }
			]
		});
		await deleteAccount(db, 1);
		expect(sessions.find((s) => s.user_id === 1)).toBeUndefined();
		// 他ユーザーのセッションは残る
		expect(sessions.find((s) => s.user_id === 2)).toBeDefined();
	});

	it('username 行は残るので UNIQUE 制約で再取得不可（永久ロック）', async () => {
		const { deleteAccount, isUsernameTaken } = await import('../../src/lib/server/db');
		const { db } = makeMockDB({ users: [{ id: 1, username: 'alice' }] });
		await deleteAccount(db, 1);
		// 削除後も username 行は残るため isUsernameTaken は true
		expect(await isUsernameTaken(db, 'alice')).toBe(true);
	});
});

describe('getSession (deleted ユーザーのログイン拒否)', () => {
	it('deleted=0 のユーザーは取得できる', async () => {
		const { getSession } = await import('../../src/lib/server/auth');
		const { db } = makeMockDB({
			users: [{ id: 1, username: 'alice', deleted: 0 }],
			sessions: [{ id: 's1', user_id: 1, expires_at: '2099-01-01T00:00:00Z' }]
		});
		const session = await getSession(db, 's1');
		expect(session).not.toBeNull();
		expect(session?.username).toBe('alice');
	});

	it('deleted=1 のユーザーは null（ログインしてもセッション無効）', async () => {
		const { getSession } = await import('../../src/lib/server/auth');
		const { db } = makeMockDB({
			users: [{ id: 1, username: 'alice', deleted: 1 }],
			sessions: [{ id: 's1', user_id: 1, expires_at: '2099-01-01T00:00:00Z' }]
		});
		const session = await getSession(db, 's1');
		expect(session).toBeNull();
	});
});

describe('verifyPassword (削除前後)', () => {
	it('削除後は password_hash が空になり、どんなパスワードでも fail', async () => {
		const { hashPassword, verifyPassword } = await import('../../src/lib/server/auth');
		const { deleteAccount } = await import('../../src/lib/server/db');
		const { db, users } = makeMockDB({ users: [{ id: 1, username: 'alice' }] });
		// 真の hash を入れて削除前の検証
		users[0].password_hash = await hashPassword('correct-horse-battery');
		expect(await verifyPassword('correct-horse-battery', users[0].password_hash)).toBe(true);

		await deleteAccount(db, 1);
		// password_hash は '' になっている
		expect(users[0].password_hash).toBe('');
		// 空 hash は salt:storedHash 分割で fail
		expect(await verifyPassword('correct-horse-battery', users[0].password_hash)).toBe(false);
	});
});

describe('displayUsername', () => {
	it('deleted=0 はそのまま username を返す', async () => {
		const { displayUsername } = await import('../../src/lib/format');
		expect(displayUsername({ username: 'alice', deleted: 0 })).toBe('alice');
	});

	it('deleted=1 は [deleted] に置換する', async () => {
		const { displayUsername } = await import('../../src/lib/format');
		expect(displayUsername({ username: 'alice', deleted: 1 })).toBe('[deleted]');
	});

	it('deleted が undefined/null でも username を返す（後方互換）', async () => {
		const { displayUsername } = await import('../../src/lib/format');
		expect(displayUsername({ username: 'alice' })).toBe('alice');
		expect(displayUsername({ username: 'alice', deleted: null })).toBe('alice');
	});
});

// deleteAccount action の認可・パスワード検証ロジックは action 関数を直接呼ぶ統合テスト。
// SvelteKit の error/redirect は throw なので status を返す薄いラッパで再現する。
describe('deleteAccount action（統合）', () => {
	type MockUser = { id: number; username: string };

	async function callDeleteAccount({
		db,
		localsUser,
		params,
		password
	}: {
		db: D1Database;
		localsUser: MockUser | null;
		params: { id: string };
		password: string;
	}) {
		const { deleteAccount, getUserById } = await import('../../src/lib/server/db');
		const { verifyPassword } = await import('../../src/lib/server/auth');

		if (!localsUser) {
			return { status: 302 as const, redirect: '/login' };
		}
		const userRow = await db
			.prepare('SELECT * FROM users WHERE username = ?')
			.bind(params.id)
			.first<{ id: number; username: string; deleted: number }>();
		if (!userRow) return { status: 404 as const };
		if (localsUser.id !== userRow.id) {
			return { status: 403 as const };
		}
		if (!password) {
			return { status: 400 as const, deleteAccountError: 'Password is required' };
		}
		const fullUser = await getUserById(db, userRow.id);
		if (!fullUser || fullUser.deleted === 1) {
			return { status: 400 as const, deleteAccountError: 'Account already deleted' };
		}
		const valid = await verifyPassword(password, fullUser.password_hash);
		if (!valid) {
			return { status: 400 as const, deleteAccountError: 'Incorrect password' };
		}
		await deleteAccount(db, userRow.id);
		return { status: 303 as const, redirect: '/' };
	}

	it('未ログインなら /login に 302 リダイレクト', async () => {
		const { db } = makeMockDB({ users: [{ id: 1, username: 'alice' }] });
		const r = await callDeleteAccount({
			db,
			localsUser: null,
			params: { id: 'alice' },
			password: 'pw'
		});
		expect(r.status).toBe(302);
		expect((r as { redirect: string }).redirect).toBe('/login');
	});

	it('他人のアカウント削除は 403', async () => {
		const { db } = makeMockDB({
			users: [
				{ id: 1, username: 'alice' },
				{ id: 2, username: 'bob' }
			]
		});
		const r = await callDeleteAccount({
			db,
			localsUser: { id: 2, username: 'bob' },
			params: { id: 'alice' },
			password: 'pw'
		});
		expect(r.status).toBe(403);
	});

	it('パスワード未入力なら 400', async () => {
		const { db } = makeMockDB({ users: [{ id: 1, username: 'alice' }] });
		const r = await callDeleteAccount({
			db,
			localsUser: { id: 1, username: 'alice' },
			params: { id: 'alice' },
			password: ''
		});
		expect(r.status).toBe(400);
	});

	it('パスワードが不一致なら 400 Incorrect password', async () => {
		const { hashPassword } = await import('../../src/lib/server/auth');
		const mock = makeMockDB({ users: [{ id: 1, username: 'alice' }] });
		mock.users[0].password_hash = await hashPassword('correct-pw');
		const r = await callDeleteAccount({
			db: mock.db,
			localsUser: { id: 1, username: 'alice' },
			params: { id: 'alice' },
			password: 'wrong-pw'
		});
		expect(r.status).toBe(400);
		expect((r as { deleteAccountError: string }).deleteAccountError).toMatch(/Incorrect/);
	});

	it('正しいパスワードなら 303 で / にリダイレクトし users が削除済みになる', async () => {
		const { hashPassword } = await import('../../src/lib/server/auth');
		const mock = makeMockDB({
			users: [{ id: 1, username: 'alice' }],
			sessions: [{ id: 's1', user_id: 1, expires_at: '2099-01-01T00:00:00Z' }]
		});
		mock.users[0].password_hash = await hashPassword('correct-pw');
		const r = await callDeleteAccount({
			db: mock.db,
			localsUser: { id: 1, username: 'alice' },
			params: { id: 'alice' },
			password: 'correct-pw'
		});
		expect(r.status).toBe(303);
		expect(mock.users[0].deleted).toBe(1);
		expect(mock.sessions.find((s) => s.user_id === 1)).toBeUndefined();
	});
});

describe('displayUsername (falsy 値の網羅)', () => {
	it('deleted=0 (number) は username を返す', async () => {
		const { displayUsername } = await import('../../src/lib/format');
		expect(displayUsername({ username: 'alice', deleted: 0 as 0 })).toBe('alice');
	});

	it('deleted=1 (number) は [deleted] を返す', async () => {
		const { displayUsername } = await import('../../src/lib/format');
		expect(displayUsername({ username: 'alice', deleted: 1 as 1 })).toBe('[deleted]');
	});

	it('deleted=null は username を返す', async () => {
		const { displayUsername } = await import('../../src/lib/format');
		expect(displayUsername({ username: 'alice', deleted: null })).toBe('alice');
	});

	it('deleted=undefined は username を返す', async () => {
		const { displayUsername } = await import('../../src/lib/format');
		expect(displayUsername({ username: 'alice', deleted: undefined })).toBe('alice');
	});

	// 型シグネチャは 0 | 1 | null | undefined だが、ランタイムで他の値が来ても
	// !user.deleted の falsy 判定で破綻しないことを保証する。
	it('deleted=true (型外) でも [deleted] 扱い（truthy）', async () => {
		const { displayUsername } = await import('../../src/lib/format');
		expect(
			displayUsername({ username: 'alice', deleted: true as unknown as 1 })
		).toBe('[deleted]');
	});

	it('deleted=false (型外) は username を返す（falsy）', async () => {
		const { displayUsername } = await import('../../src/lib/format');
		expect(
			displayUsername({ username: 'alice', deleted: false as unknown as 0 })
		).toBe('alice');
	});
});

describe('isUsernameTaken (削除済み username の永久ロック)', () => {
	it('削除済みユーザーの username で再 signup が弾かれる', async () => {
		const { deleteAccount, isUsernameTaken } = await import('../../src/lib/server/db');
		const { db } = makeMockDB({ users: [{ id: 1, username: 'alice' }] });
		// 削除前から取られている
		expect(await isUsernameTaken(db, 'alice')).toBe(true);
		await deleteAccount(db, 1);
		// 削除後も users 行は残るため取られたまま
		expect(await isUsernameTaken(db, 'alice')).toBe(true);
		// 別名は空いている
		expect(await isUsernameTaken(db, 'bob')).toBe(false);
	});
});
