/**
 * Unit tests for the hide feature (#85).
 *
 * 対象:
 *   - DB ヘルパ: hasHidden / getHiddenStoryIds
 *   - API ハンドラ: POST /api/hide （401/400/404 + toggle）
 *
 * D1 はネイティブ依存があり CI では本物を使えないため、必要な SQL に対応する
 * in-memory モックを書いて関数の振る舞いを検証する（account-deletion.test.ts と同じ流儀）。
 */
import { describe, it, expect } from 'vitest';

interface StoryRecord {
	id: number;
	user_id: number;
	title: string;
	url: string | null;
	text: string | null;
	type: string;
	points: number;
	comment_count: number;
	dead: number;
	created_at: string;
}

interface HiddenRecord {
	user_id: number;
	story_id: number;
	created_at: string;
}

function makeMockDB(initial?: { stories?: Partial<StoryRecord>[]; hidden?: HiddenRecord[] }) {
	const storyDefaults: Omit<StoryRecord, 'id' | 'user_id' | 'title'> = {
		url: null,
		text: 'body',
		type: 'story',
		points: 1,
		comment_count: 0,
		dead: 0,
		created_at: '2026-04-01T00:00:00Z'
	};
	const stories: StoryRecord[] = (initial?.stories ?? []).map(
		(s) => ({ ...storyDefaults, ...s } as StoryRecord)
	);
	const hidden: HiddenRecord[] = [...(initial?.hidden ?? [])];

	function exec(sql: string, params: unknown[]): { all: unknown[]; first: unknown } {
		const s = sql.replace(/\s+/g, ' ').trim();

		// hasHidden: SELECT 1 FROM hidden WHERE user_id = ? AND story_id = ?
		if (/^SELECT 1 FROM hidden WHERE user_id = \? AND story_id = \?$/i.test(s)) {
			const userId = params[0] as number;
			const storyId = params[1] as number;
			const hit = hidden.some((h) => h.user_id === userId && h.story_id === storyId);
			return { all: hit ? [{ '1': 1 }] : [], first: hit ? { '1': 1 } : null };
		}

		// getHiddenStoryIds: SELECT story_id FROM hidden WHERE user_id = ?
		if (/^SELECT story_id FROM hidden WHERE user_id = \?$/i.test(s)) {
			const userId = params[0] as number;
			const rows = hidden
				.filter((h) => h.user_id === userId)
				.map((h) => ({ story_id: h.story_id }));
			return { all: rows, first: rows[0] ?? null };
		}

		// INSERT INTO hidden (user_id, story_id) VALUES (?, ?)
		if (/^INSERT INTO hidden \(user_id, story_id\) VALUES \(\?, \?\)$/i.test(s)) {
			const userId = params[0] as number;
			const storyId = params[1] as number;
			// 簡易 UNIQUE: 既にあれば追加しない（DB は UNIQUE 制約で弾くが本番が呼ぶ前に
			// hasHidden で確認しているのでテスト上はこれで十分）
			if (!hidden.some((h) => h.user_id === userId && h.story_id === storyId)) {
				hidden.push({
					user_id: userId,
					story_id: storyId,
					created_at: new Date().toISOString()
				});
			}
			return { all: [], first: null };
		}

		// DELETE FROM hidden WHERE user_id = ? AND story_id = ?
		if (/^DELETE FROM hidden WHERE user_id = \? AND story_id = \?$/i.test(s)) {
			const userId = params[0] as number;
			const storyId = params[1] as number;
			for (let i = hidden.length - 1; i >= 0; i--) {
				if (hidden[i].user_id === userId && hidden[i].story_id === storyId) {
					hidden.splice(i, 1);
				}
			}
			return { all: [], first: null };
		}

		// getStoryById:
		//   SELECT s.*, u.username, ..., (subquery) AS flag_count
		//   FROM stories s JOIN users u ON s.user_id = u.id
		//   WHERE s.id = ?
		if (
			/FROM stories s JOIN users u ON s\.user_id = u\.id WHERE s\.id = \?$/i.test(s) &&
			/^SELECT s\.\*/i.test(s)
		) {
			const storyId = params[0] as number;
			const row = stories.find((x) => x.id === storyId);
			if (!row) return { all: [], first: null };
			const enriched = {
				...row,
				username: 'mock_user',
				user_created_at: '2026-01-01T00:00:00Z',
				user_deleted: 0,
				flag_count: 0
			};
			return { all: [enriched], first: enriched };
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
		stories,
		hidden
	};
}

describe('hasHidden / getHiddenStoryIds', () => {
	it('hidden 行が無ければ hasHidden=false / getHiddenStoryIds は空 Set', async () => {
		const { hasHidden, getHiddenStoryIds } = await import('../../src/lib/server/db');
		const { db } = makeMockDB({
			stories: [{ id: 10, user_id: 1, title: 'a' }]
		});
		expect(await hasHidden(db, 1, 10)).toBe(false);
		const ids = await getHiddenStoryIds(db, 1);
		expect(ids.size).toBe(0);
	});

	it('INSERT 後 hasHidden=true / getHiddenStoryIds に story_id が含まれる', async () => {
		const { hasHidden, getHiddenStoryIds } = await import('../../src/lib/server/db');
		const { db } = makeMockDB({
			stories: [
				{ id: 10, user_id: 1, title: 'a' },
				{ id: 11, user_id: 1, title: 'b' }
			]
		});
		await db
			.prepare('INSERT INTO hidden (user_id, story_id) VALUES (?, ?)')
			.bind(7, 10)
			.run();
		expect(await hasHidden(db, 7, 10)).toBe(true);
		expect(await hasHidden(db, 7, 11)).toBe(false);
		const ids = await getHiddenStoryIds(db, 7);
		expect(ids.has(10)).toBe(true);
		expect(ids.has(11)).toBe(false);
	});

	it('DELETE 後 hasHidden=false / getHiddenStoryIds から消える', async () => {
		const { hasHidden, getHiddenStoryIds } = await import('../../src/lib/server/db');
		const { db } = makeMockDB({
			stories: [{ id: 10, user_id: 1, title: 'a' }],
			hidden: [{ user_id: 7, story_id: 10, created_at: '2026-04-01T00:00:00Z' }]
		});
		expect(await hasHidden(db, 7, 10)).toBe(true);
		await db
			.prepare('DELETE FROM hidden WHERE user_id = ? AND story_id = ?')
			.bind(7, 10)
			.run();
		expect(await hasHidden(db, 7, 10)).toBe(false);
		const ids = await getHiddenStoryIds(db, 7);
		expect(ids.size).toBe(0);
	});

	it('別ユーザーの hidden は混ざらない', async () => {
		const { hasHidden, getHiddenStoryIds } = await import('../../src/lib/server/db');
		const { db } = makeMockDB({
			stories: [
				{ id: 10, user_id: 1, title: 'a' },
				{ id: 11, user_id: 1, title: 'b' }
			],
			hidden: [
				{ user_id: 7, story_id: 10, created_at: '2026-04-01T00:00:00Z' },
				{ user_id: 8, story_id: 11, created_at: '2026-04-01T00:00:00Z' }
			]
		});
		expect(await hasHidden(db, 7, 10)).toBe(true);
		expect(await hasHidden(db, 7, 11)).toBe(false);
		expect(await hasHidden(db, 8, 10)).toBe(false);
		expect(await hasHidden(db, 8, 11)).toBe(true);

		const idsForA = await getHiddenStoryIds(db, 7);
		expect([...idsForA]).toEqual([10]);
		const idsForB = await getHiddenStoryIds(db, 8);
		expect([...idsForB]).toEqual([11]);
	});
});

// API ハンドラを直接呼ぶための薄い RequestEvent ラッパ。
type Locals = { user: { id: number; username: string } | null };
async function callPostHide({
	db,
	user,
	body
}: {
	db: D1Database;
	user: Locals['user'];
	body: unknown;
}): Promise<{ status: number; body: unknown }> {
	const { POST } = await import('../../src/routes/api/hide/+server');
	const request = new Request('http://localhost/api/hide', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	const event = {
		request,
		platform: { env: { DB: db } },
		locals: { user } as Locals,
		// 以下は型を満たすためのダミー
		params: {},
		url: new URL('http://localhost/api/hide'),
		route: { id: '/api/hide' },
		fetch: globalThis.fetch,
		cookies: {} as never,
		getClientAddress: () => '127.0.0.1',
		setHeaders: () => {},
		isDataRequest: false,
		isSubRequest: false
	} as unknown as Parameters<typeof POST>[0];
	const res = await POST(event);
	const json = await res.json();
	return { status: res.status, body: json };
}

describe('POST /api/hide', () => {
	it('未ログインなら 401', async () => {
		const { db } = makeMockDB({ stories: [{ id: 10, user_id: 1, title: 'a' }] });
		const r = await callPostHide({
			db,
			user: null,
			body: { storyId: 10 }
		});
		expect(r.status).toBe(401);
	});

	it('storyId 無し（空 body）なら 400', async () => {
		const { db } = makeMockDB({ stories: [{ id: 10, user_id: 1, title: 'a' }] });
		const r = await callPostHide({
			db,
			user: { id: 7, username: 'bob' },
			body: {}
		});
		expect(r.status).toBe(400);
	});

	it('storyId が文字列なら 400', async () => {
		const { db } = makeMockDB({ stories: [{ id: 10, user_id: 1, title: 'a' }] });
		const r = await callPostHide({
			db,
			user: { id: 7, username: 'bob' },
			body: { storyId: 'foo' }
		});
		expect(r.status).toBe(400);
	});

	it('story が存在しないなら 404', async () => {
		const { db } = makeMockDB({ stories: [{ id: 10, user_id: 1, title: 'a' }] });
		const r = await callPostHide({
			db,
			user: { id: 7, username: 'bob' },
			body: { storyId: 999 }
		});
		expect(r.status).toBe(404);
	});

	it('未 hidden なら INSERT され { hidden: true } を返す', async () => {
		const { hasHidden } = await import('../../src/lib/server/db');
		const mock = makeMockDB({ stories: [{ id: 10, user_id: 1, title: 'a' }] });
		const r = await callPostHide({
			db: mock.db,
			user: { id: 7, username: 'bob' },
			body: { storyId: 10 }
		});
		expect(r.status).toBe(200);
		expect(r.body).toEqual({ hidden: true });
		expect(await hasHidden(mock.db, 7, 10)).toBe(true);
	});

	it('既に hidden なら DELETE され { hidden: false } を返す（toggle）', async () => {
		const { hasHidden } = await import('../../src/lib/server/db');
		const mock = makeMockDB({
			stories: [{ id: 10, user_id: 1, title: 'a' }],
			hidden: [{ user_id: 7, story_id: 10, created_at: '2026-04-01T00:00:00Z' }]
		});
		const r = await callPostHide({
			db: mock.db,
			user: { id: 7, username: 'bob' },
			body: { storyId: 10 }
		});
		expect(r.status).toBe(200);
		expect(r.body).toEqual({ hidden: false });
		expect(await hasHidden(mock.db, 7, 10)).toBe(false);
	});

	it('連続 POST で hidden が true→false にトグルする', async () => {
		const { hasHidden } = await import('../../src/lib/server/db');
		const mock = makeMockDB({ stories: [{ id: 10, user_id: 1, title: 'a' }] });

		const r1 = await callPostHide({
			db: mock.db,
			user: { id: 7, username: 'bob' },
			body: { storyId: 10 }
		});
		expect(r1.body).toEqual({ hidden: true });
		expect(await hasHidden(mock.db, 7, 10)).toBe(true);

		const r2 = await callPostHide({
			db: mock.db,
			user: { id: 7, username: 'bob' },
			body: { storyId: 10 }
		});
		expect(r2.body).toEqual({ hidden: false });
		expect(await hasHidden(mock.db, 7, 10)).toBe(false);
	});
});
