/**
 * Unit tests for the username change feature (#75).
 *
 * D1 はネイティブ依存があり、CI 環境では本物の D1 を回せないため、
 * 必要最小限の in-memory モックを書いて関数の振る舞いを検証する。
 * モックは src/lib/server/db.ts が実行する SQL の形（PRAGMA や JOIN なし、
 * 単純な SELECT/INSERT/UPDATE）に合わせて手書きしている。
 */
import { describe, it, expect } from 'vitest';

interface UserRecord {
	id: number;
	username: string;
}
interface HistoryRecord {
	id: number;
	user_id: number;
	old_username: string;
	new_username: string;
	changed_at: string;
}

function makeMockDB(initial?: { users?: UserRecord[]; history?: HistoryRecord[] }) {
	const users: UserRecord[] = [...(initial?.users ?? [])];
	const history: HistoryRecord[] = [...(initial?.history ?? [])];
	let nextHistoryId = history.reduce((m, h) => Math.max(m, h.id), 0) + 1;

	function exec(sql: string, params: unknown[]): { all: unknown[]; first: unknown } {
		const s = sql.replace(/\s+/g, ' ').trim();

		if (/^SELECT 1 FROM users WHERE username = \?$/i.test(s)) {
			const u = users.find((x) => x.username === params[0]);
			return { all: u ? [{ '1': 1 }] : [], first: u ? { '1': 1 } : null };
		}
		if (/^SELECT 1 FROM username_history WHERE old_username = \?$/i.test(s)) {
			const h = history.find((x) => x.old_username === params[0]);
			return { all: h ? [{ '1': 1 }] : [], first: h ? { '1': 1 } : null };
		}
		if (/^SELECT new_username FROM username_history WHERE old_username = \? ORDER BY changed_at DESC LIMIT 1$/i.test(s)) {
			const matches = history
				.filter((x) => x.old_username === params[0])
				.sort((a, b) => (a.changed_at < b.changed_at ? 1 : -1));
			const r = matches[0];
			return { all: r ? [r] : [], first: r ? { new_username: r.new_username } : null };
		}
		if (/^SELECT changed_at FROM username_history WHERE user_id = \? ORDER BY changed_at DESC LIMIT 1$/i.test(s)) {
			const matches = history
				.filter((x) => x.user_id === params[0])
				.sort((a, b) => (a.changed_at < b.changed_at ? 1 : -1));
			const r = matches[0];
			return { all: r ? [r] : [], first: r ? { changed_at: r.changed_at } : null };
		}
		if (/^UPDATE users SET username = \? WHERE id = \?$/i.test(s)) {
			const u = users.find((x) => x.id === params[1]);
			if (u) u.username = params[0] as string;
			return { all: [], first: null };
		}
		if (
			/^INSERT INTO username_history \(user_id, old_username, new_username\) VALUES \(\?, \?, \?\)$/i.test(s)
		) {
			history.push({
				id: nextHistoryId++,
				user_id: params[0] as number,
				old_username: params[1] as string,
				new_username: params[2] as string,
				changed_at: new Date().toISOString()
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
		_sql: string;
		_params: unknown[];
	};

	function prepare(sql: string): Stmt {
		const stmt: Stmt = {
			_sql: sql,
			_params: [],
			bind(...p: unknown[]) {
				stmt._params = p;
				return stmt;
			},
			async first<T>() {
				return exec(sql, stmt._params).first as T | null;
			},
			async all<T>() {
				return { results: exec(sql, stmt._params).all as T[] };
			},
			async run() {
				exec(sql, stmt._params);
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
		// テストから履歴を直接書き換えるためのヘルパ
		pushHistory(rec: Omit<HistoryRecord, 'id'>) {
			history.push({ id: nextHistoryId++, ...rec });
		}
	};
}

describe('isUsernameTaken', () => {
	it('現在の users.username に存在するなら true', async () => {
		const { isUsernameTaken } = await import('../../src/lib/server/db');
		const { db } = makeMockDB({ users: [{ id: 1, username: 'alice' }] });
		expect(await isUsernameTaken(db, 'alice')).toBe(true);
	});

	it('過去の username_history.old_username に存在するなら true（履歴ロック）', async () => {
		const { isUsernameTaken } = await import('../../src/lib/server/db');
		const { db } = makeMockDB({
			users: [{ id: 1, username: 'alice2' }],
			history: [
				{
					id: 1,
					user_id: 1,
					old_username: 'alice',
					new_username: 'alice2',
					changed_at: '2026-01-01T00:00:00Z'
				}
			]
		});
		expect(await isUsernameTaken(db, 'alice')).toBe(true);
	});

	it('どこにも無ければ false', async () => {
		const { isUsernameTaken } = await import('../../src/lib/server/db');
		const { db } = makeMockDB({ users: [{ id: 1, username: 'bob' }] });
		expect(await isUsernameTaken(db, 'newcomer')).toBe(false);
	});
});

describe('getOldUsernameRedirect', () => {
	it('履歴があれば最新の new_username を返す', async () => {
		const { getOldUsernameRedirect } = await import('../../src/lib/server/db');
		const { db } = makeMockDB({
			users: [{ id: 1, username: 'b' }],
			history: [
				{ id: 1, user_id: 1, old_username: 'a', new_username: 'b', changed_at: '2026-01-01T00:00:00Z' }
			]
		});
		expect(await getOldUsernameRedirect(db, 'a')).toBe('b');
	});

	it('連鎖変更（A→B→C）を最新まで辿る', async () => {
		const { getOldUsernameRedirect } = await import('../../src/lib/server/db');
		const { db } = makeMockDB({
			users: [{ id: 1, username: 'c' }],
			history: [
				{ id: 1, user_id: 1, old_username: 'a', new_username: 'b', changed_at: '2026-01-01T00:00:00Z' },
				{ id: 2, user_id: 1, old_username: 'b', new_username: 'c', changed_at: '2026-02-01T00:00:00Z' }
			]
		});
		expect(await getOldUsernameRedirect(db, 'a')).toBe('c');
	});

	it('履歴に無ければ null', async () => {
		const { getOldUsernameRedirect } = await import('../../src/lib/server/db');
		const { db } = makeMockDB();
		expect(await getOldUsernameRedirect(db, 'ghost')).toBeNull();
	});
});

describe('getLastUsernameChange / 90日制限の境界', () => {
	const COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;

	it('履歴が無ければ null', async () => {
		const { getLastUsernameChange } = await import('../../src/lib/server/db');
		const { db } = makeMockDB();
		expect(await getLastUsernameChange(db, 1)).toBeNull();
	});

	it('cooldown 内の last change は制限に該当する', async () => {
		const { getLastUsernameChange, USERNAME_CHANGE_COOLDOWN_MS } = await import(
			'../../src/lib/server/db'
		);
		expect(USERNAME_CHANGE_COOLDOWN_MS).toBe(COOLDOWN_MS);

		const lastIso = new Date(Date.now() - COOLDOWN_MS / 2).toISOString();
		const { db } = makeMockDB({
			users: [{ id: 1, username: 'alice' }],
			history: [
				{ id: 1, user_id: 1, old_username: 'a', new_username: 'alice', changed_at: lastIso }
			]
		});
		const last = await getLastUsernameChange(db, 1);
		expect(last).toBe(lastIso);
		const nextMs = new Date(last!).getTime() + USERNAME_CHANGE_COOLDOWN_MS;
		expect(nextMs > Date.now()).toBe(true);
	});

	it('cooldown を過ぎていれば再変更可能', async () => {
		const { getLastUsernameChange, USERNAME_CHANGE_COOLDOWN_MS } = await import(
			'../../src/lib/server/db'
		);
		const lastIso = new Date(Date.now() - COOLDOWN_MS - 1000).toISOString();
		const { db } = makeMockDB({
			users: [{ id: 1, username: 'alice' }],
			history: [
				{ id: 1, user_id: 1, old_username: 'a', new_username: 'alice', changed_at: lastIso }
			]
		});
		const last = await getLastUsernameChange(db, 1);
		const nextMs = new Date(last!).getTime() + USERNAME_CHANGE_COOLDOWN_MS;
		expect(nextMs <= Date.now()).toBe(true);
	});
});

describe('updateUsername', () => {
	it('users.username を更新し、history に旧名を記録する', async () => {
		const { updateUsername } = await import('../../src/lib/server/db');
		const { db, users, history } = makeMockDB({
			users: [{ id: 1, username: 'alice' }]
		});
		await updateUsername(db, 1, 'alice', 'alice2');
		expect(users[0].username).toBe('alice2');
		expect(history).toHaveLength(1);
		expect(history[0]).toMatchObject({
			user_id: 1,
			old_username: 'alice',
			new_username: 'alice2'
		});
	});

	it('変更後は旧名が isUsernameTaken でロックされる', async () => {
		const { updateUsername, isUsernameTaken } = await import('../../src/lib/server/db');
		const { db } = makeMockDB({ users: [{ id: 1, username: 'alice' }] });
		await updateUsername(db, 1, 'alice', 'alice2');
		expect(await isUsernameTaken(db, 'alice')).toBe(true);
		expect(await isUsernameTaken(db, 'alice2')).toBe(true);
	});
});

describe('validateUsernameFormat', () => {
	it('signup と同じ規則（3-15文字、英数字+_-）に合致するものは null', async () => {
		const { validateUsernameFormat } = await import('../../src/lib/server/db');
		expect(validateUsernameFormat('alice')).toBeNull();
		expect(validateUsernameFormat('a-b_c')).toBeNull();
		expect(validateUsernameFormat('abc')).toBeNull();
		expect(validateUsernameFormat('a'.repeat(15))).toBeNull();
	});

	it('短すぎる/長すぎる/記号入りはエラーメッセージを返す', async () => {
		const { validateUsernameFormat } = await import('../../src/lib/server/db');
		expect(validateUsernameFormat('')).toMatch(/required/);
		expect(validateUsernameFormat('ab')).toMatch(/3 and 15/);
		expect(validateUsernameFormat('a'.repeat(16))).toMatch(/3 and 15/);
		expect(validateUsernameFormat('alice!')).toMatch(/letters, numbers/);
	});
});
