/**
 * Unit tests for the flag / vouch feature (Issue #179 バッチA).
 *
 * 対象:
 *   - API ハンドラ: POST /api/flag   (401/403/400/404/自分の投稿403/insert・unflag/dead自動化)
 *   - API ハンドラ: POST /api/vouch  (401/403/404/dead=0なら400/自分の投稿403/revive)
 *   - DB ヘルパ: getStoryById / getCommentById が dead=1 でも行を返す（showdead 非依存）
 *
 * D1 はネイティブ依存があり CI では本物を使えないため、必要な SQL に対応する
 * in-memory モックを書いて関数の振る舞いを検証する（hide.test.ts と同じ流儀）。
 *
 * flag / vouch ハンドラは locals.user.karma / locals.user.id を直接読むだけで
 * users テーブルは引かないため、モックには users を用意しない
 * （stories / comments / flags の3テーブルのみで足りる）。
 */
import { describe, it, expect } from 'vitest';
import { DEAD_FLAG_THRESHOLD, FLAG_KARMA_THRESHOLD, VOUCH_KARMA_THRESHOLD } from '../../src/lib/constants';

interface StoryRecord {
	id: number;
	user_id: number;
	dead: number;
}

interface CommentRecord {
	id: number;
	user_id: number;
	story_id: number;
	dead: number;
}

interface FlagRecord {
	user_id: number;
	item_id: number;
	item_type: 'story' | 'comment';
}

function makeMockDB(initial?: {
	stories?: Partial<StoryRecord>[];
	comments?: Partial<CommentRecord>[];
	flags?: FlagRecord[];
}) {
	const storyDefaults: Omit<StoryRecord, 'id' | 'user_id'> = { dead: 0 };
	const commentDefaults: Omit<CommentRecord, 'id' | 'user_id' | 'story_id'> = { dead: 0 };
	const stories: StoryRecord[] = (initial?.stories ?? []).map(
		(s) => ({ ...storyDefaults, ...s } as StoryRecord)
	);
	const comments: CommentRecord[] = (initial?.comments ?? []).map(
		(c) => ({ ...commentDefaults, ...c } as CommentRecord)
	);
	const flags: FlagRecord[] = [...(initial?.flags ?? [])];

	function flagCountFor(itemId: number, itemType: string): number {
		return flags.filter((f) => f.item_id === itemId && f.item_type === itemType).length;
	}

	function exec(sql: string, params: unknown[]): { all: unknown[]; first: unknown } {
		const s = sql.replace(/\s+/g, ' ').trim();

		// getStoryById: SELECT s.*, u.username, ... (flag_count subquery) FROM stories s JOIN users u ... WHERE s.id = ?
		if (
			/^SELECT s\.\*, u\.username, u\.created_at as user_created_at, u\.deleted as user_deleted, .* FROM stories s JOIN users u ON s\.user_id = u\.id WHERE s\.id = \?$/i.test(
				s
			)
		) {
			const id = params[0] as number;
			const row = stories.find((x) => x.id === id);
			if (!row) return { all: [], first: null };
			const enriched = { ...row, flag_count: flagCountFor(row.id, 'story') };
			return { all: [enriched], first: enriched };
		}

		// getCommentById: SELECT c.*, u.username, ... (flag_count subquery) FROM comments c JOIN users u ... WHERE c.id = ?
		if (
			/^SELECT c\.\*, u\.username, u\.created_at as user_created_at, u\.deleted as user_deleted, .* FROM comments c JOIN users u ON c\.user_id = u\.id WHERE c\.id = \?$/i.test(
				s
			)
		) {
			const id = params[0] as number;
			const row = comments.find((x) => x.id === id);
			if (!row) return { all: [], first: null };
			const enriched = { ...row, flag_count: flagCountFor(row.id, 'comment') };
			return { all: [enriched], first: enriched };
		}

		// hasFlagged: SELECT 1 FROM flags WHERE user_id = ? AND item_id = ? AND item_type = ?
		if (
			/^SELECT 1 FROM flags WHERE user_id = \? AND item_id = \? AND item_type = \?$/i.test(s)
		) {
			const [userId, itemId, itemType] = params as [number, number, string];
			const hit = flags.some(
				(f) => f.user_id === userId && f.item_id === itemId && f.item_type === itemType
			);
			return { all: hit ? [{ '1': 1 }] : [], first: hit ? { '1': 1 } : null };
		}

		// getFlagCount: SELECT COUNT(*) AS n FROM flags WHERE item_id = ? AND item_type = ?
		if (/^SELECT COUNT\(\*\) AS n FROM flags WHERE item_id = \? AND item_type = \?$/i.test(s)) {
			const [itemId, itemType] = params as [number, string];
			const n = flagCountFor(itemId, itemType);
			return { all: [{ n }], first: { n } };
		}

		// INSERT INTO flags (user_id, item_id, item_type) VALUES (?, ?, ?)
		if (
			/^INSERT INTO flags \(user_id, item_id, item_type\) VALUES \(\?, \?, \?\)$/i.test(s)
		) {
			const [userId, itemId, itemType] = params as [number, number, string];
			flags.push({ user_id: userId, item_id: itemId, item_type: itemType as 'story' | 'comment' });
			return { all: [], first: null };
		}

		// unflag: DELETE FROM flags WHERE user_id = ? AND item_id = ? AND item_type = ?
		if (
			/^DELETE FROM flags WHERE user_id = \? AND item_id = \? AND item_type = \?$/i.test(s)
		) {
			const [userId, itemId, itemType] = params as [number, number, string];
			for (let i = flags.length - 1; i >= 0; i--) {
				if (
					flags[i].user_id === userId &&
					flags[i].item_id === itemId &&
					flags[i].item_type === itemType
				) {
					flags.splice(i, 1);
				}
			}
			return { all: [], first: null };
		}

		// vouch: DELETE FROM flags WHERE item_id = ? AND item_type = ? (全削除)
		if (/^DELETE FROM flags WHERE item_id = \? AND item_type = \?$/i.test(s)) {
			const [itemId, itemType] = params as [number, string];
			for (let i = flags.length - 1; i >= 0; i--) {
				if (flags[i].item_id === itemId && flags[i].item_type === itemType) {
					flags.splice(i, 1);
				}
			}
			return { all: [], first: null };
		}

		// UPDATE stories SET dead = 1 WHERE id = ?
		if (/^UPDATE stories SET dead = 1 WHERE id = \?$/i.test(s)) {
			const id = params[0] as number;
			const row = stories.find((x) => x.id === id);
			if (row) row.dead = 1;
			return { all: [], first: null };
		}

		// UPDATE comments SET dead = 1 WHERE id = ?
		if (/^UPDATE comments SET dead = 1 WHERE id = \?$/i.test(s)) {
			const id = params[0] as number;
			const row = comments.find((x) => x.id === id);
			if (row) row.dead = 1;
			return { all: [], first: null };
		}

		// UPDATE stories SET dead = 0 WHERE id = ? (vouch)
		if (/^UPDATE stories SET dead = 0 WHERE id = \?$/i.test(s)) {
			const id = params[0] as number;
			const row = stories.find((x) => x.id === id);
			if (row) row.dead = 0;
			return { all: [], first: null };
		}

		// UPDATE comments SET dead = 0 WHERE id = ? (vouch)
		if (/^UPDATE comments SET dead = 0 WHERE id = \?$/i.test(s)) {
			const id = params[0] as number;
			const row = comments.find((x) => x.id === id);
			if (row) row.dead = 0;
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
		for (const st of stmts) await st.run();
	}

	return {
		db: { prepare, batch } as unknown as D1Database,
		stories,
		comments,
		flags
	};
}

// API ハンドラを直接呼ぶための薄い RequestEvent ラッパ（hide.test.ts の callPostHide を踏襲）。
// /api/flag と /api/vouch を1つの汎用関数にまとめると、動的 import の結果が
// 「POST の型のユニオン」になり、その POST を呼ぶ引数の型が両ルートの交差型を要求されて
// 決して満たせなくなる（RouteParams の route id リテラルが '/api/flag' | '/api/vouch' で
// 両立しないため）。ルートごとに素朴に分けたほうが型が素直になる。
type Locals = { user: { id: number; username: string; karma: number } | null };

function buildEvent(route: string, db: D1Database, user: Locals['user'], body: unknown) {
	const request = new Request(`http://localhost${route}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	return {
		request,
		platform: { env: { DB: db } },
		locals: { user } as Locals,
		params: {},
		url: new URL(`http://localhost${route}`),
		route: { id: route },
		fetch: globalThis.fetch,
		cookies: {} as never,
		getClientAddress: () => '127.0.0.1',
		setHeaders: () => {},
		isDataRequest: false,
		isSubRequest: false
	};
}

async function callPostFlag({
	db,
	user,
	body
}: {
	db: D1Database;
	user: Locals['user'];
	body: unknown;
}): Promise<{ status: number; body: unknown }> {
	const { POST } = await import('../../src/routes/api/flag/+server');
	const event = buildEvent('/api/flag', db, user, body) as unknown as Parameters<typeof POST>[0];
	const res = await POST(event);
	return { status: res.status, body: await res.json() };
}

async function callPostVouch({
	db,
	user,
	body
}: {
	db: D1Database;
	user: Locals['user'];
	body: unknown;
}): Promise<{ status: number; body: unknown }> {
	const { POST } = await import('../../src/routes/api/vouch/+server');
	const event = buildEvent('/api/vouch', db, user, body) as unknown as Parameters<typeof POST>[0];
	const res = await POST(event);
	return { status: res.status, body: await res.json() };
}

const OWNER = { id: 1, username: 'owner', karma: 100 };

describe('POST /api/flag', () => {
	it('U1: 未ログインなら 401', async () => {
		const { db } = makeMockDB({ stories: [{ id: 10, user_id: OWNER.id }] });
		const r = await callPostFlag({
			db,
			user: null,
			body: { itemId: 10, itemType: 'story' }
		});
		expect(r.status).toBe(401);
	});

	it(`U2: karma=1（< ${FLAG_KARMA_THRESHOLD}）なら 403`, async () => {
		const { db } = makeMockDB({ stories: [{ id: 10, user_id: OWNER.id }] });
		const r = await callPostFlag({
			db,
			user: { id: 7, username: 'bob', karma: 1 },
			body: { itemId: 10, itemType: 'story' }
		});
		expect(r.status).toBe(403);
	});

	it(`U3: karma=${FLAG_KARMA_THRESHOLD}（境界ちょうど）なら成功`, async () => {
		const { db } = makeMockDB({ stories: [{ id: 10, user_id: OWNER.id }] });
		const r = await callPostFlag({
			db,
			user: { id: 7, username: 'bob', karma: FLAG_KARMA_THRESHOLD },
			body: { itemId: 10, itemType: 'story' }
		});
		expect(r.status).toBe(200);
	});

	it('U4: 自分の投稿を flag すると 403 になり flags 行が増えない', async () => {
		const mock = makeMockDB({ stories: [{ id: 10, user_id: OWNER.id }] });
		const r = await callPostFlag({
			db: mock.db,
			user: { ...OWNER, karma: 100 },
			body: { itemId: 10, itemType: 'story' }
		});
		expect(r.status).toBe(403);
		expect(mock.flags.length).toBe(0);
	});

	it('U5: 他人の投稿を初回 flag すると 200・flagged:true・flags に1行追加', async () => {
		const mock = makeMockDB({ stories: [{ id: 10, user_id: OWNER.id }] });
		const r = await callPostFlag({
			db: mock.db,
			user: { id: 7, username: 'bob', karma: 100 },
			body: { itemId: 10, itemType: 'story' }
		});
		expect(r.status).toBe(200);
		expect(r.body).toMatchObject({ flagged: true, flagCount: 1 });
		expect(mock.flags).toEqual([{ user_id: 7, item_id: 10, item_type: 'story' }]);
	});

	it('U6: 既に flag 済みの投稿を再度 flag すると unflag される（200・flagged:false・行削除）', async () => {
		const mock = makeMockDB({
			stories: [{ id: 10, user_id: OWNER.id }],
			flags: [{ user_id: 7, item_id: 10, item_type: 'story' }]
		});
		const r = await callPostFlag({
			db: mock.db,
			user: { id: 7, username: 'bob', karma: 100 },
			body: { itemId: 10, itemType: 'story' }
		});
		expect(r.status).toBe(200);
		expect(r.body).toMatchObject({ flagged: false, flagCount: 0 });
		expect(mock.flags.length).toBe(0);
	});

	it('U7: 存在しない itemId なら 404', async () => {
		const { db } = makeMockDB({ stories: [{ id: 10, user_id: OWNER.id }] });
		const r = await callPostFlag({
			db,
			user: { id: 7, username: 'bob', karma: 100 },
			body: { itemId: 999, itemType: 'story' }
		});
		expect(r.status).toBe(404);
	});

	it('U8: itemId が文字列/小数/0/負値/未指定なら 400', async () => {
		const { db } = makeMockDB({ stories: [{ id: 10, user_id: OWNER.id }] });
		const user = { id: 7, username: 'bob', karma: 100 };
		for (const itemId of ['foo', 1.5, 0, -1, undefined]) {
			const r = await callPostFlag({ db, user, body: { itemId, itemType: 'story' } });
			expect(r.status, `itemId=${JSON.stringify(itemId)}`).toBe(400);
		}
	});

	it('U9: itemType が想定外/空文字/未指定なら 400', async () => {
		const { db } = makeMockDB({ stories: [{ id: 10, user_id: OWNER.id }] });
		const user = { id: 7, username: 'bob', karma: 100 };
		for (const itemType of ['poll', '', undefined]) {
			const r = await callPostFlag({ db, user, body: { itemId: 10, itemType } });
			expect(r.status, `itemType=${JSON.stringify(itemType)}`).toBe(400);
		}
	});

	it(`U10: flag数3件目（< ${DEAD_FLAG_THRESHOLD}）では dead 化しない`, async () => {
		const mock = makeMockDB({
			stories: [{ id: 10, user_id: OWNER.id }],
			flags: [
				{ user_id: 101, item_id: 10, item_type: 'story' },
				{ user_id: 102, item_id: 10, item_type: 'story' }
			]
		});
		const r = await callPostFlag({
			db: mock.db,
			user: { id: 103, username: 'u103', karma: 100 },
			body: { itemId: 10, itemType: 'story' }
		});
		expect(r.status).toBe(200);
		expect(r.body).toMatchObject({ dead: false, flagCount: 3 });
		expect(mock.stories.find((s) => s.id === 10)?.dead).toBe(0);
	});

	it(`U11（境界・最重要）: flag数が DEAD_FLAG_THRESHOLD（${DEAD_FLAG_THRESHOLD}件目・ちょうど）では dead 化しない`, async () => {
		const mock = makeMockDB({
			stories: [{ id: 10, user_id: OWNER.id }],
			flags: [
				{ user_id: 101, item_id: 10, item_type: 'story' },
				{ user_id: 102, item_id: 10, item_type: 'story' },
				{ user_id: 103, item_id: 10, item_type: 'story' }
			]
		});
		const r = await callPostFlag({
			db: mock.db,
			user: { id: 104, username: 'u104', karma: 100 },
			body: { itemId: 10, itemType: 'story' }
		});
		expect(r.status).toBe(200);
		expect(r.body).toMatchObject({ dead: false, flagCount: DEAD_FLAG_THRESHOLD });
		expect(mock.stories.find((s) => s.id === 10)?.dead).toBe(0);
	});

	it(`U12（境界・最重要）: flag数が DEAD_FLAG_THRESHOLD を超える（${DEAD_FLAG_THRESHOLD + 1}件目）と dead=1 に自動更新される`, async () => {
		const mock = makeMockDB({
			stories: [{ id: 10, user_id: OWNER.id }],
			flags: [
				{ user_id: 101, item_id: 10, item_type: 'story' },
				{ user_id: 102, item_id: 10, item_type: 'story' },
				{ user_id: 103, item_id: 10, item_type: 'story' },
				{ user_id: 104, item_id: 10, item_type: 'story' }
			]
		});
		const r = await callPostFlag({
			db: mock.db,
			user: { id: 105, username: 'u105', karma: 100 },
			body: { itemId: 10, itemType: 'story' }
		});
		expect(r.status).toBe(200);
		expect(r.body).toMatchObject({ dead: true, flagCount: DEAD_FLAG_THRESHOLD + 1 });
		expect(mock.stories.find((s) => s.id === 10)?.dead).toBe(1);
	});

	it('U13: dead化済みアイテムに未flagの6人目が新規flagすると400・flags件数は増えない', async () => {
		const mock = makeMockDB({
			stories: [{ id: 10, user_id: OWNER.id, dead: 1 }],
			flags: [101, 102, 103, 104, 105].map((uid) => ({
				user_id: uid,
				item_id: 10,
				item_type: 'story' as const
			}))
		});
		const r = await callPostFlag({
			db: mock.db,
			user: { id: 106, username: 'u106', karma: 100 },
			body: { itemId: 10, itemType: 'story' }
		});
		expect(r.status).toBe(400);
		expect(mock.flags.length).toBe(5);
	});

	it('U14: dead化済みアイテムの既存flaggerがunflagしても200成功するがdeadは1のまま戻らない', async () => {
		const mock = makeMockDB({
			stories: [{ id: 10, user_id: OWNER.id, dead: 1 }],
			flags: [101, 102, 103, 104, 105].map((uid) => ({
				user_id: uid,
				item_id: 10,
				item_type: 'story' as const
			}))
		});
		const r = await callPostFlag({
			db: mock.db,
			user: { id: 105, username: 'u105', karma: 100 },
			body: { itemId: 10, itemType: 'story' }
		});
		expect(r.status).toBe(200);
		expect(r.body).toMatchObject({ flagged: false, flagCount: 4, dead: true });
		expect(mock.stories.find((s) => s.id === 10)?.dead).toBe(1);
	});

	it('U15: comment に対する flag でも同じ閾値ロジックが働く', async () => {
		const mock = makeMockDB({
			stories: [{ id: 10, user_id: OWNER.id }],
			comments: [{ id: 50, user_id: OWNER.id, story_id: 10 }],
			flags: [201, 202, 203, 204].map((uid) => ({
				user_id: uid,
				item_id: 50,
				item_type: 'comment' as const
			}))
		});
		const r = await callPostFlag({
			db: mock.db,
			user: { id: 205, username: 'u205', karma: 100 },
			body: { itemId: 50, itemType: 'comment' }
		});
		expect(r.status).toBe(200);
		expect(r.body).toMatchObject({ dead: true, flagCount: DEAD_FLAG_THRESHOLD + 1 });
		expect(mock.comments.find((c) => c.id === 50)?.dead).toBe(1);
	});

	it('U16: 自分の投稿がdead化した状態でflagしても403（自分チェックが先）', async () => {
		const mock = makeMockDB({ stories: [{ id: 10, user_id: OWNER.id, dead: 1 }] });
		const r = await callPostFlag({
			db: mock.db,
			user: { ...OWNER, karma: 100 },
			body: { itemId: 10, itemType: 'story' }
		});
		expect(r.status).toBe(403);
		expect(mock.flags.length).toBe(0);
	});
});

describe('POST /api/vouch', () => {
	it('U17: 未ログインなら 401', async () => {
		const { db } = makeMockDB({ stories: [{ id: 10, user_id: OWNER.id, dead: 1 }] });
		const r = await callPostVouch({ db, user: null, body: { itemId: 10, itemType: 'story' } });
		expect(r.status).toBe(401);
	});

	it(`U18: karma不足（< ${VOUCH_KARMA_THRESHOLD}）なら 403`, async () => {
		const { db } = makeMockDB({ stories: [{ id: 10, user_id: OWNER.id, dead: 1 }] });
		const r = await callPostVouch({
			db,
			user: { id: 7, username: 'bob', karma: 1 },
			body: { itemId: 10, itemType: 'story' }
		});
		expect(r.status).toBe(403);
	});

	it('U19: 存在しない itemId なら 404', async () => {
		const { db } = makeMockDB({ stories: [{ id: 10, user_id: OWNER.id, dead: 1 }] });
		const r = await callPostVouch({
			db,
			user: { id: 7, username: 'bob', karma: 100 },
			body: { itemId: 999, itemType: 'story' }
		});
		expect(r.status).toBe(404);
	});

	it('U20: dead=0のアイテムをvouchすると400', async () => {
		const { db } = makeMockDB({ stories: [{ id: 10, user_id: OWNER.id, dead: 0 }] });
		const r = await callPostVouch({
			db,
			user: { id: 7, username: 'bob', karma: 100 },
			body: { itemId: 10, itemType: 'story' }
		});
		expect(r.status).toBe(400);
	});

	it('U21: 自分の投稿が非dead状態でvouchしても400（dead判定が自分チェックより先）', async () => {
		const { db } = makeMockDB({ stories: [{ id: 10, user_id: OWNER.id, dead: 0 }] });
		const r = await callPostVouch({
			db,
			user: { ...OWNER, karma: 100 },
			body: { itemId: 10, itemType: 'story' }
		});
		expect(r.status).toBe(400);
	});

	it('U22: 自分の投稿がdead状態でvouchすると403', async () => {
		const { db } = makeMockDB({ stories: [{ id: 10, user_id: OWNER.id, dead: 1 }] });
		const r = await callPostVouch({
			db,
			user: { ...OWNER, karma: 100 },
			body: { itemId: 10, itemType: 'story' }
		});
		expect(r.status).toBe(403);
	});

	it('U23: 他人のdeadな投稿をvouchすると200・dead=0に戻り・紐づくflagsが全削除される', async () => {
		const mock = makeMockDB({
			stories: [
				{ id: 10, user_id: OWNER.id, dead: 1 },
				{ id: 11, user_id: OWNER.id, dead: 0 }
			],
			flags: [
				{ user_id: 101, item_id: 10, item_type: 'story' },
				{ user_id: 102, item_id: 10, item_type: 'story' },
				// 別アイテムの flag は巻き込まれず残ることを確認するためのノイズ
				{ user_id: 103, item_id: 11, item_type: 'story' }
			]
		});
		const r = await callPostVouch({
			db: mock.db,
			user: { id: 7, username: 'bob', karma: 100 },
			body: { itemId: 10, itemType: 'story' }
		});
		expect(r.status).toBe(200);
		expect(r.body).toMatchObject({ vouched: true });
		expect(mock.stories.find((s) => s.id === 10)?.dead).toBe(0);
		expect(mock.flags.filter((f) => f.item_id === 10)).toEqual([]);
		// 別アイテムの flag は影響を受けない
		expect(mock.flags.filter((f) => f.item_id === 11)).toEqual([
			{ user_id: 103, item_id: 11, item_type: 'story' }
		]);
	});

	it('U24: vouch後に同じ投稿へ再度flagが可能になる', async () => {
		const mock = makeMockDB({
			stories: [{ id: 10, user_id: OWNER.id, dead: 1 }],
			flags: [
				{ user_id: 101, item_id: 10, item_type: 'story' },
				{ user_id: 102, item_id: 10, item_type: 'story' }
			]
		});
		await callPostVouch({
			db: mock.db,
			user: { id: 7, username: 'bob', karma: 100 },
			body: { itemId: 10, itemType: 'story' }
		});
		const r = await callPostFlag({
			db: mock.db,
			user: { id: 108, username: 'u108', karma: 100 },
			body: { itemId: 10, itemType: 'story' }
		});
		expect(r.status).toBe(200);
		expect(r.body).toMatchObject({ flagged: true, flagCount: 1, dead: false });
	});

	it('U25: vouch対象がcommentでも200・dead=0に戻る', async () => {
		const mock = makeMockDB({
			comments: [{ id: 50, user_id: OWNER.id, story_id: 10, dead: 1 }],
			flags: [{ user_id: 101, item_id: 50, item_type: 'comment' }]
		});
		const r = await callPostVouch({
			db: mock.db,
			user: { id: 7, username: 'bob', karma: 100 },
			body: { itemId: 50, itemType: 'comment' }
		});
		expect(r.status).toBe(200);
		expect(mock.comments.find((c) => c.id === 50)?.dead).toBe(0);
		expect(mock.flags.filter((f) => f.item_id === 50 && f.item_type === 'comment')).toEqual([]);
	});
});

describe('showdead 非依存のクエリヘルパ（詳細ページ・permalink は常に dead を見せる）', () => {
	it('U27: getStoryByIdはdead=1でも行を返す', async () => {
		const { getStoryById } = await import('../../src/lib/server/db');
		const { db } = makeMockDB({ stories: [{ id: 10, user_id: OWNER.id, dead: 1 }] });
		const row = await getStoryById(db, 10);
		expect(row).not.toBeNull();
		expect(row?.dead).toBe(1);
	});

	it('U28: getCommentByIdはdead=1でも行を返す', async () => {
		const { getCommentById } = await import('../../src/lib/server/db');
		const { db } = makeMockDB({
			comments: [{ id: 50, user_id: OWNER.id, story_id: 10, dead: 1 }]
		});
		const row = await getCommentById(db, 50);
		expect(row).not.toBeNull();
		expect(row?.dead).toBe(1);
	});
});
