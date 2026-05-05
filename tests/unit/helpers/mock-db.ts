/**
 * SvelteKit form action のユニットテスト用に使う、汎用 D1 mock。
 *
 * #95 の editStory / deleteStory / comment 系 action を直接呼び出して検証するために、
 * stories / users / comments / sessions / hidden / username_history / votes 等の
 * 行を in-memory で持ち、`+page.server.ts` 側が実際に発行する SQL に対応する分岐を持つ。
 *
 * 既存の `account-deletion.test.ts` の `makeMockDB` から派生したが、
 * テストで使う必要のあるテーブル種類を増やしてある。既存テストには影響を与えない。
 *
 * 設計方針:
 *   - 完全な SQL パーサにはしない。`+page.server.ts` と `db.ts` が発行する具体的 SQL を
 *     正規化して照合する。新しい action をテストする際はここに分岐を追加する。
 *   - 未対応 SQL は throw して気づけるようにする（silently 通すと不可視のバグになる）。
 */

export interface StoryRecord {
	id: number;
	title: string;
	url: string | null;
	text: string | null;
	user_id: number;
	points: number;
	comment_count: number;
	type: string;
	dead: number;
	created_at: string;
}

export interface UserRecord {
	id: number;
	username: string;
	password_hash: string;
	karma: number;
	about: string;
	email: string;
	delay: number;
	noprocrast: number;
	maxvisit: number;
	minaway: number;
	showdead: number;
	last_visit: string | null;
	created_at: string;
	deleted: number;
	deleted_at: string | null;
	is_admin: number;
}

export interface CommentRecord {
	id: number;
	text: string;
	user_id: number;
	story_id: number;
	parent_id: number | null;
	points: number;
	dead: number;
	created_at: string;
}

export interface SessionRecord {
	id: string;
	user_id: number;
	expires_at: string;
}

export interface MockDBState {
	stories: StoryRecord[];
	users: UserRecord[];
	comments: CommentRecord[];
	sessions: SessionRecord[];
}

export interface MakeMockDBOpts {
	stories?: Partial<StoryRecord>[];
	users?: Partial<UserRecord>[];
	comments?: Partial<CommentRecord>[];
	sessions?: SessionRecord[];
}

const USER_DEFAULTS: Omit<UserRecord, 'id' | 'username'> = {
	password_hash: 'hash',
	karma: 0,
	about: '',
	email: '',
	delay: 0,
	noprocrast: 0,
	maxvisit: 20,
	minaway: 180,
	showdead: 0,
	last_visit: null,
	created_at: '2026-01-01T00:00:00Z',
	deleted: 0,
	deleted_at: null,
	is_admin: 0
};

const STORY_DEFAULTS: Omit<StoryRecord, 'id' | 'user_id'> = {
	title: 'a story',
	url: null,
	text: null,
	points: 1,
	comment_count: 0,
	type: 'story',
	dead: 0,
	created_at: new Date().toISOString()
};

const COMMENT_DEFAULTS: Omit<CommentRecord, 'id' | 'user_id' | 'story_id'> = {
	text: 'hello',
	parent_id: null,
	points: 1,
	dead: 0,
	created_at: new Date().toISOString()
};

export interface MockDBHandle {
	db: D1Database;
	state: MockDBState;
}

export function makeMockDB(initial?: MakeMockDBOpts): MockDBHandle {
	const users: UserRecord[] = (initial?.users ?? []).map(
		(u) => ({ ...USER_DEFAULTS, ...u } as UserRecord)
	);
	const stories: StoryRecord[] = (initial?.stories ?? []).map(
		(s) => ({ ...STORY_DEFAULTS, ...s } as StoryRecord)
	);
	const comments: CommentRecord[] = (initial?.comments ?? []).map(
		(c) => ({ ...COMMENT_DEFAULTS, ...c } as CommentRecord)
	);
	const sessions: SessionRecord[] = [...(initial?.sessions ?? [])];

	function joinStoryWithUser(s: StoryRecord) {
		const u = users.find((x) => x.id === s.user_id);
		return {
			...s,
			username: u?.username ?? '[gone]',
			user_created_at: u?.created_at ?? null,
			user_deleted: u?.deleted ?? 0,
			flag_count: 0
		};
	}

	function joinCommentWithUser(c: CommentRecord) {
		const u = users.find((x) => x.id === c.user_id);
		return {
			...c,
			username: u?.username ?? '[gone]',
			user_created_at: u?.created_at ?? null,
			user_deleted: u?.deleted ?? 0,
			author_delay: u?.delay ?? 0,
			flag_count: 0
		};
	}

	function exec(sql: string, params: unknown[]): { all: unknown[]; first: unknown } {
		const s = sql.replace(/\s+/g, ' ').trim();

		// getStoryById: SELECT s.*, u.username, ... FROM stories s JOIN users u ... WHERE s.id = ?
		if (
			/^SELECT s\.\*, u\.username, u\.created_at as user_created_at, u\.deleted as user_deleted, .* FROM stories s JOIN users u ON s\.user_id = u\.id WHERE s\.id = \?$/i.test(
				s
			)
		) {
			const id = params[0] as number;
			const story = stories.find((x) => x.id === id);
			if (!story) return { all: [], first: null };
			const row = joinStoryWithUser(story);
			return { all: [row], first: row };
		}

		// getCommentById: SELECT c.*, u.username, ... FROM comments c JOIN users u ... WHERE c.id = ?
		if (
			/^SELECT c\.\*, u\.username, u\.created_at as user_created_at, u\.deleted as user_deleted, .* FROM comments c JOIN users u ON c\.user_id = u\.id WHERE c\.id = \?$/i.test(
				s
			)
		) {
			const id = params[0] as number;
			const comment = comments.find((x) => x.id === id);
			if (!comment) return { all: [], first: null };
			const row = joinCommentWithUser(comment);
			return { all: [row], first: row };
		}

		// editStory: UPDATE stories SET title = ?, text = ?, type = ? WHERE id = ?
		if (/^UPDATE stories SET title = \?, text = \?, type = \? WHERE id = \?$/i.test(s)) {
			const [title, text, type, id] = params as [string, string | null, string, number];
			const story = stories.find((x) => x.id === id);
			if (story) {
				story.title = title;
				story.text = text;
				story.type = type;
			}
			return { all: [], first: null };
		}

		// deleteStory: UPDATE stories SET title = ?, url = ?, text = ? WHERE id = ?
		if (/^UPDATE stories SET title = \?, url = \?, text = \? WHERE id = \?$/i.test(s)) {
			const [title, url, text, id] = params as [string, string | null, string, number];
			const story = stories.find((x) => x.id === id);
			if (story) {
				story.title = title;
				story.url = url;
				story.text = text;
			}
			return { all: [], first: null };
		}

		// editComment / deleteComment: UPDATE comments SET text = ? WHERE id = ?
		if (/^UPDATE comments SET text = \? WHERE id = \?$/i.test(s)) {
			const [text, id] = params as [string, number];
			const comment = comments.find((x) => x.id === id);
			if (comment) comment.text = text;
			return { all: [], first: null };
		}

		// comment action: SELECT created_at FROM comments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1
		if (
			/^SELECT created_at FROM comments WHERE user_id = \? ORDER BY created_at DESC LIMIT 1$/i.test(
				s
			)
		) {
			const userId = params[0] as number;
			const own = comments
				.filter((c) => c.user_id === userId)
				.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
			const top = own[0];
			return { all: top ? [{ created_at: top.created_at }] : [], first: top ? { created_at: top.created_at } : null };
		}

		// comment action: INSERT INTO comments (text, user_id, story_id, parent_id) VALUES (?, ?, ?, ?)
		if (
			/^INSERT INTO comments \(text, user_id, story_id, parent_id\) VALUES \(\?, \?, \?, \?\)$/i.test(s)
		) {
			const [text, userId, storyId, parentId] = params as [
				string,
				number,
				number,
				number | null
			];
			const id = (comments.reduce((m, c) => Math.max(m, c.id), 0) || 0) + 1;
			comments.push({
				...COMMENT_DEFAULTS,
				id,
				text,
				user_id: userId,
				story_id: storyId,
				parent_id: parentId,
				created_at: new Date().toISOString()
			});
			return { all: [], first: null };
		}

		// comment action: UPDATE stories SET comment_count = comment_count + 1 WHERE id = ?
		if (/^UPDATE stories SET comment_count = comment_count \+ 1 WHERE id = \?$/i.test(s)) {
			const id = params[0] as number;
			const story = stories.find((x) => x.id === id);
			if (story) story.comment_count += 1;
			return { all: [], first: null };
		}

		throw new Error(`Unhandled SQL in mock-db: ${s}`);
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
		state: { stories, users, comments, sessions }
	};
}
